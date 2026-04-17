"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "../novo/actions";
import { fetchLogs, type LogRow } from "./actions";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Canal = "todos" | "Quente" | "Frio";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const CANAL_LABELS: Record<Canal, string> = {
  todos: "Geral",
  Quente: "Inbound",
  Frio: "Outbound",
};

const EMPRESAS_FIXAS = ["Ousen", "Arven"];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function Dashboard({
  sdrNome,
  sdrRole,
  initialRows,
  initialRange,
}: {
  sdrNome: string;
  sdrRole: string;
  initialRows: LogRow[];
  initialRange: [string, string];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<LogRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [[dateFrom, dateTo], setRange] = useState<[string, string]>(initialRange);
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [canalFiltro, setCanalFiltro] = useState<Canal>("todos");
  const didMountRef = useRef(false);

  // Lista de empresas: fixas + quaisquer extras que apareçam nos registros
  const empresasDisponiveis = useMemo(() => {
    const set = new Set<string>(EMPRESAS_FIXAS);
    rows.forEach((r) => {
      if (r.empresa && r.empresa.trim() !== "") set.add(r.empresa);
    });
    return [...set].sort();
  }, [rows]);

  // Rows após filtro de empresa
  const filteredRows = useMemo(() => {
    if (empresaFiltro === "todas") return rows;
    return rows.filter((r) => r.empresa === empresaFiltro);
  }, [rows, empresaFiltro]);

  // Rows após filtro de canal (Inbound/Outbound) — base pra todas as métricas abaixo
  const displayRows = useMemo(() => {
    if (canalFiltro === "todos") return filteredRows;
    return filteredRows.filter((r) => r.temperatura === canalFiltro);
  }, [filteredRows, canalFiltro]);

  const canalLabel = CANAL_LABELS[canalFiltro];
  const showMkt = canalFiltro === "todos" || canalFiltro === "Quente";
  const showProsp = canalFiltro === "todos" || canalFiltro === "Frio";

  // Quick presets
  function setPreset(p: "hoje" | "semana" | "mes") {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    if (p === "hoje") return setRange([to, to]);
    if (p === "semana") {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + 1);
      return setRange([d.toISOString().slice(0, 10), to]);
    }
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    setRange([`${y}-${m}-01`, to]);
  }

  // Refetch via server action (corre no Vercel — DNS estável)
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLogs(dateFrom, dateTo);
      setRows(data);
    } catch (e) {
      console.error("[bi/dashboard] fetchLogs failed:", e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  // Primeiro render já vem com initialRows do SSR — só refaz quando a data muda
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    reload();
  }, [reload]);

  // Realtime — best-effort. Se a conexão WS falhar por DNS, apenas não há live update;
  // a página inicial continua funcionando.
  useEffect(() => {
    const ch = supabase
      .channel("log_sdr_rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "log_sdr" },
        () => reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, reload]);

  // -------------------------------------------------------------------------
  // Computed metrics (sobre displayRows — já filtrado por empresa e canal)
  // -------------------------------------------------------------------------
  const total = displayRows.length;
  const atendidas = displayRows.filter((r) => r.call_result === "Ligações Atendidas").length;
  const ligarNovamente = displayRows.filter((r) => r.call_result === "Ligar Novamente").length;
  const cttWhats = displayRows.filter((r) => r.call_result === "Em contato Whatsapp").length;
  const cttEmail = displayRows.filter((r) => r.call_result === "Em contato E-mail").length;
  const contatos = atendidas + cttWhats + cttEmail;
  const decisores = displayRows.filter((r) => r.decisor === "Sim").length;

  // Marcações
  const marcProspeccao = displayRows.filter((r) => r.lead_result === "Marcações Prospecção").length;
  const marcMarketing = displayRows.filter((r) => r.lead_result === "Marcações Marketing").length;
  const marcTotal = marcProspeccao + marcMarketing;

  // Modalidade
  const discovery = displayRows.filter((r) => r.modalidade_ligacao === "Discovery Call");
  const tentando = displayRows.filter((r) => r.modalidade_ligacao === "Tentando Contato");

  // Taxas
  const taxaAtend = total > 0 ? (contatos / total) * 100 : 0;
  const taxaMarcLeads = total > 0 ? (marcTotal / total) * 100 : 0;
  const taxaMarcContato = contatos > 0 ? (marcTotal / contatos) * 100 : 0;

  // Perdidos
  const perdidos = useMemo(() => {
    const map = new Map<string, number>();
    displayRows.forEach((r) => {
      if (
        r.lead_result &&
        r.lead_result !== "" &&
        !r.lead_result.startsWith("Marcações") &&
        !r.lead_result.startsWith("MKT - Marc") &&
        r.lead_result !== "Delay Recuperado"
      ) {
        map.set(r.lead_result, (map.get(r.lead_result) ?? 0) + 1);
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [displayRows]);
  const totalPerdido = perdidos.reduce((s, [, c]) => s + c, 0);
  const taxaPerdidosContato = contatos > 0 ? (totalPerdido / contatos) * 100 : 0;

  // -------------------------------------------------------------------------
  // Chart data: por dia (respeita todos os filtros)
  // -------------------------------------------------------------------------
  const dailyData = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        total: number;
        atendidas: number;
        naoAtendidas: number;
        ligarNovamente: number;
        cttWhats: number;
        cttEmail: number;
        decisores: number;
        marcacoes: number;
        marcMkt: number;
        marcProsp: number;
        marcAcum: number;
      }
    >();

    const sorted = [...displayRows].sort((a, b) => a.data_registro.localeCompare(b.data_registro));
    sorted.forEach((r) => {
      const d = r.data_registro;
      const prev = map.get(d) ?? {
        date: fmtDate(d),
        total: 0,
        atendidas: 0,
        naoAtendidas: 0,
        ligarNovamente: 0,
        cttWhats: 0,
        cttEmail: 0,
        decisores: 0,
        marcacoes: 0,
        marcMkt: 0,
        marcProsp: 0,
        marcAcum: 0,
      };
      prev.total++;
      if (r.call_result === "Ligações Atendidas") prev.atendidas++;
      if (r.call_result === "Não Atendidas") prev.naoAtendidas++;
      if (r.call_result === "Ligar Novamente") prev.ligarNovamente++;
      if (r.call_result === "Em contato Whatsapp") prev.cttWhats++;
      if (r.call_result === "Em contato E-mail") prev.cttEmail++;
      if (r.decisor === "Sim") prev.decisores++;
      if (r.lead_result === "Marcações Marketing") {
        prev.marcacoes++;
        prev.marcMkt++;
      }
      if (r.lead_result === "Marcações Prospecção") {
        prev.marcacoes++;
        prev.marcProsp++;
      }
      map.set(d, prev);
    });

    let acum = 0;
    const arr = [...map.values()];
    arr.forEach((d) => {
      acum += d.marcacoes;
      d.marcAcum = acum;
    });
    return arr;
  }, [displayRows]);

  function handleSignOut() {
    signOut().then(() => {
      router.push("/login");
      router.refresh();
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <header className="mb-1 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">RelatorioMensalSDR</h1>
          <p className="text-xs text-slate-400">
            {sdrNome}{" "}
            {sdrRole === "gestor" || sdrRole === "admin" ? "· visão geral" : ""}
            {empresaFiltro !== "todas" ? ` · ${empresaFiltro}` : " · todas as empresas"}
            {" · "}
            {canalLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/novo" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            + Novo registro
          </a>
          <button onClick={handleSignOut} className="text-xs font-medium text-slate-400 hover:text-slate-700">
            Sair
          </button>
        </div>
      </header>

      {/* Date picker + filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
        <span className="text-xs font-semibold text-slate-500">Período:</span>
        {(["hoje", "semana", "mes"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className="rounded px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
          >
            {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
          </button>
        ))}
        <span className="mx-1 text-slate-300">|</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setRange([e.target.value, dateTo])}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400"
        />
        <span className="text-xs text-slate-400">até</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setRange([dateFrom, e.target.value])}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400"
        />
        <span className="mx-1 text-slate-300">|</span>
        <span className="text-xs font-semibold text-slate-500">Empresa:</span>
        <select
          value={empresaFiltro}
          onChange={(e) => setEmpresaFiltro(e.target.value)}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="todas">Todas</option>
          {empresasDisponiveis.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <span className="mx-1 text-slate-300">|</span>
        <span className="text-xs font-semibold text-slate-500">Canal:</span>
        <div className="flex gap-1">
          {(["todos", "Quente", "Frio"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCanalFiltro(c)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                canalFiltro === c
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {CANAL_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-400">Carregando...</div>
      ) : (
        <>
          {/* ============================================================= */}
          {/* SEÇÃO 1 — STATUS LIGAÇÃO                                      */}
          {/* ============================================================= */}
          <SectionTitle>Status Ligação {canalLabel}</SectionTitle>

          {/* Taxa Atendimento */}
          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <PercentBar value={taxaAtend} color="#ef4444" />
            </div>
            <span className="text-2xl font-bold text-red-500">
              {taxaAtend.toFixed(1)}%
            </span>
          </div>

          {/* Big Stats + Charts lado a lado */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <BigStat label={`Total Ligações ${canalLabel}`} value={total} color="#16a34a" />
              <BigStat label="Ligar Novamente" value={ligarNovamente} color="#16a34a" />
              <BigStat label="Em contato Whatsapp" value={cttWhats} color="#16a34a" />
              <BigStat label="Em contato E-mail" value={cttEmail} color="#16a34a" />
            </div>

            {/* Taxa Atendimento por dia */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold text-slate-500">Taxa Atendimento {canalLabel}</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="atendidas" name="Atendidas" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Análise Ligações */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold text-slate-500">Análise Ligações ({canalLabel})</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="atendidas" name="Atendidas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="naoAtendidas" name="Não Atendidas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="ligarNovamente" name="Ligar Novamente" stroke="#8b5cf6" strokeWidth={1} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="cttWhats" name="WhatsApp" stroke="#06b6d4" strokeWidth={1} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ============================================================= */}
          {/* SEÇÃO 2 — MARCAÇÕES                                           */}
          {/* ============================================================= */}
          <SectionTitle>Marcações Restantes</SectionTitle>

          {/* Barra marcações */}
          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <PercentBar value={100} color="#f59e0b" />
            </div>
            <span className="text-2xl font-bold text-amber-500">{marcTotal}</span>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Status Marcações — linha acumulada */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
              <p className="mb-2 text-xs font-semibold text-slate-500">Status Marcações</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="marcAcum" name="Marcações Acumuladas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="marcacoes" name="Marcações/Dia" stroke="#f59e0b" strokeWidth={1} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Gauge Marcações Totais */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6">
              <Gauge value={marcTotal} max={Math.max(marcTotal * 2, 50)} />
              <p className="mt-2 text-3xl font-bold text-slate-800">{marcTotal}</p>
              <p className="text-xs text-slate-400">Marcações Totais</p>
            </div>
          </div>

          {/* ============================================================= */}
          {/* SEÇÃO 3 — STATUS MARCAÇÃO + TAXAS                             */}
          {/* ============================================================= */}
          <SectionTitle>Status Marcação ({canalLabel})</SectionTitle>

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Stats lado esquerdo */}
            <div className="space-y-3">
              <StatRow label="Leads Total" value={total} />
              <StatRow label={`Total Ligações ${canalLabel}`} value={total} />
              <StatRow label={`Ligações Atendidas ${canalLabel}`} value={atendidas} />
              <StatRow label="Decisores Alcançados" value={decisores} />
              {showMkt && <StatRow label="Marcações Marketing (Inbound)" value={marcMarketing} />}
              {showProsp && <StatRow label="Marcações Prospecção (Outbound)" value={marcProspeccao} />}
            </div>

            {/* Gráfico linha status ligação */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold text-slate-500">Status Ligação ({canalLabel})</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="total" name={`Total ${canalLabel}`} stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="atendidas" name="Atendidas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="decisores" name="Decisores" stroke="#8b5cf6" strokeWidth={1} dot={{ r: 2 }} />
                  {showMkt && (
                    <Line type="monotone" dataKey="marcMkt" name="Marcações MKT" stroke="#06b6d4" strokeWidth={1} dot={{ r: 2 }} />
                  )}
                  {showProsp && (
                    <Line type="monotone" dataKey="marcProsp" name="Marcações Prospecção" stroke="#0ea5e9" strokeWidth={1} dot={{ r: 2 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Taxas marcação */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-1 text-xs font-semibold text-slate-500">Taxa Marcação ({canalLabel})</p>
                <div className="flex items-end gap-4">
                  <div className="flex-1 text-center">
                    <div className="mx-auto mb-1 w-16 overflow-hidden rounded bg-slate-100">
                      <div
                        className="h-24 rounded bg-red-500 transition-all"
                        style={{ height: `${Math.min(taxaMarcLeads, 100)}%` }}
                      />
                    </div>
                    <p className="text-lg font-bold text-slate-800">{taxaMarcLeads.toFixed(1)}%</p>
                    <p className="text-[10px] text-slate-400">Marcação/Leads</p>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="mx-auto mb-1 w-16 overflow-hidden rounded bg-slate-100">
                      <div
                        className="h-24 rounded bg-red-400 transition-all"
                        style={{ height: `${Math.min(taxaMarcContato, 100)}%` }}
                      />
                    </div>
                    <p className="text-lg font-bold text-slate-800">{taxaMarcContato.toFixed(1)}%</p>
                    <p className="text-[10px] text-slate-400">Marcação/Contato</p>
                  </div>
                </div>
              </div>

              {/* Taxa perdidos */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="h-4 w-8 rounded bg-amber-500" />
                <div>
                  <p className="text-xs text-slate-400">Perdidos / Contato</p>
                  <p className="text-lg font-bold text-amber-600">{taxaPerdidosContato.toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================= */}
          {/* SEÇÃO 4 — MODALIDADE                                          */}
          {/* ============================================================= */}
          <SectionTitle>Por Modalidade</SectionTitle>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <BigStat label="Discovery Call" value={discovery.length} color="#7c3aed" />
            <BigStat
              label="DC — Marcações"
              value={discovery.filter((r) => r.lead_result?.startsWith("Marcações") || r.lead_result?.startsWith("MKT - Marc")).length}
              color="#7c3aed"
            />
            <BigStat label="Tentando Contato" value={tentando.length} color="#0284c7" />
            <BigStat
              label="TC — Marcações"
              value={tentando.filter((r) => r.lead_result?.startsWith("Marcações") || r.lead_result?.startsWith("MKT - Marc")).length}
              color="#0284c7"
            />
          </div>

          {/* ============================================================= */}
          {/* SEÇÃO 5 — LIGAÇÕES POR DIA                                    */}
          {/* ============================================================= */}
          <SectionTitle>Ligações por Dia</SectionTitle>

          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="atendidas" name="Atendidas" fill="#16a34a" stackId="a" />
                <Bar dataKey="naoAtendidas" name="Não Atendidas" fill="#ef4444" stackId="a" />
                <Bar dataKey="ligarNovamente" name="Ligar Novamente" fill="#f59e0b" stackId="a" />
                <Bar dataKey="cttWhats" name="WhatsApp" fill="#06b6d4" stackId="a" />
                <Bar dataKey="cttEmail" name="E-mail" fill="#8b5cf6" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ============================================================= */}
          {/* SEÇÃO 6 — STATUS PERDIDOS                                     */}
          {/* ============================================================= */}
          <SectionTitle>Status Perdidos</SectionTitle>

          <div className="mb-8 rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                    Motivo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 bg-slate-50 font-semibold">
                  <td className="px-4 py-2.5 text-slate-800">Total Perdido</td>
                  <td className="px-4 py-2.5 text-right text-slate-800">{totalPerdido}</td>
                </tr>
                {perdidos.map(([motivo, count]) => (
                  <tr key={motivo} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 text-slate-600">{motivo}</td>
                    <td className="px-4 py-2.5 text-right text-slate-800">{count}</td>
                  </tr>
                ))}
                {perdidos.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                      Nenhum perdido no período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="text-center text-[11px] text-slate-300">
            {total} registros · {dateFrom} a {dateTo} · {empresaFiltro === "todas" ? "todas as empresas" : empresaFiltro} · {canalLabel} · atualização em tempo real
          </div>
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-2 text-sm font-bold text-slate-700">{children}</h2>
  );
}

function BigStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-4 py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-lg font-bold text-amber-600">{value}</span>
    </div>
  );
}

function PercentBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function Gauge({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  const angle = -90 + pct * 180;
  return (
    <div className="relative h-20 w-40 overflow-hidden">
      <svg viewBox="0 0 160 80" className="h-full w-full">
        {/* BG arc */}
        <path
          d="M 10 75 A 70 70 0 0 1 150 75"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 10 75 A 70 70 0 0 1 150 75"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${pct * 220} 220`}
        />
        {/* Needle */}
        <line
          x1="80"
          y1="75"
          x2={80 + 50 * Math.cos((angle * Math.PI) / 180)}
          y2={75 + 50 * Math.sin((angle * Math.PI) / 180)}
          stroke="#1e293b"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="80" cy="75" r="4" fill="#1e293b" />
      </svg>
    </div>
  );
}
