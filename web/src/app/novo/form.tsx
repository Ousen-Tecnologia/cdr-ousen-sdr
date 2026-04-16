"use client";

import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addRegistro, signOut, type NovoRegistroInput } from "./actions";

const MODALIDADE_OPTIONS = [
  { value: "Discovery Call", label: "Discovery Call" },
  { value: "Tentando Contato", label: "Tentando Contato" },
];

const CALL_OPTIONS = [
  { value: "Ligar Novamente", label: "Ligar Novamente" },
  { value: "Não Atendidas", label: "Não Atendida" },
  { value: "Ligações Atendidas", label: "Atendida" },
  { value: "Em contato Whatsapp", label: "Contato Whatsapp" },
  { value: "Em contato E-mail", label: "Contato E-Mail" },
];

const TEMP_OPTIONS = [
  { value: "Quente", label: "Inbound" },
  { value: "Frio", label: "Outbound" },
];

const ABERTURA_OPTIONS = [{ value: "SDR", label: "SDR" }];

const LEAD_OPTIONS = [
  { value: "", label: "—" },
  { value: "Marcações Prospecção", label: "Marcação Outbound" },
  { value: "Marcações Marketing", label: "Marcação Inbound" },
  { value: "Delay Recuperado", label: "Delay Recuperado" },
  { value: "Sem Interesse", label: "Sem Interesse" },
  { value: "Contato sem Sucesso", label: "Contato sem Sucesso" },
  { value: "Alta demanda", label: "Alta demanda" },
  { value: "Já Possui Agência/Assessoria", label: "Já Possui Agência/Assessoria" },
  { value: "Pediu para Retornar", label: "Pediu para Retornar" },
  { value: "Já Possui MKT Interno", label: "Já Possui MKT Interno" },
  { value: "CNPJ Baixado", label: "CNPJ Baixado" },
  { value: "Ctt somente por E-mail/Whats", label: "Ctt somente por E-mail/Whats" },
  { value: "Desqualificado", label: "Desqualificado" },
  { value: "Marcou R1 e Sumiu", label: "Marcou R1 e Sumiu" },
  { value: "Nº Errado", label: "Nº Errado" },
  { value: "Preencheu Errado MKT", label: "Preencheu Errado MKT" },
  { value: "MKT - Marcou R1 e Sumiu", label: "MKT - Marcou R1 e Sumiu" },
  { value: "MKT - Desqualificado/Fora ICP", label: "MKT - Desqualificado/Fora ICP" },
  { value: "MKT - Contato sem Sucesso", label: "MKT - Contato sem Sucesso" },
  { value: "MKT - Fake/Concorrente", label: "MKT - Fake/Concorrente" },
  { value: "MKT - Sem interesse", label: "MKT - Sem interesse" },
];

const EMPRESA_OPTIONS = [
  { value: "Ousen", label: "Ousen" },
  { value: "Arven", label: "Arven" },
];

const NICHO_OPTIONS = [
  { value: "Advocacia", label: "Advocacia" },
  { value: "Consultoria Tributária", label: "Consultoria Tributária" },
  { value: "Outros", label: "Outros" },
];

const initialState: NovoRegistroInput = {
  modalidade_ligacao: MODALIDADE_OPTIONS[0].value,
  call_result: CALL_OPTIONS[0].value,
  lead_result: "",
  temperatura: TEMP_OPTIONS[0].value,
  modelo_agendamento: ABERTURA_OPTIONS[0].value,
  empresa: EMPRESA_OPTIONS[0].value,
  nicho: NICHO_OPTIONS[0].value,
};

type Toast =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

type TodayMetrics = {
  total: number;
  atendidas: number;
  marcacoes: number;
  decisores: number;
};

export default function NovoForm({
  sdrNome,
  sdrId,
}: {
  sdrNome: string;
  sdrId: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<NovoRegistroInput>(initialState);
  const [toast, setToast] = useState<Toast>(null);
  const [isPending, startTransition] = useTransition();
  const [metrics, setMetrics] = useState<TodayMetrics | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const fetchMetrics = useCallback(async () => {
    if (!sdrId) return;
    const { data } = await supabase
      .from("log_sdr")
      .select("call_result, lead_result, decisor")
      .eq("sdr_id", sdrId)
      .eq("data_registro", today);

    const rows = data ?? [];
    setMetrics({
      total: rows.length,
      atendidas: rows.filter((r) => r.call_result === "Ligações Atendidas").length,
      marcacoes: rows.filter(
        (r) =>
          r.lead_result === "Marcações Prospecção" ||
          r.lead_result === "Marcações Marketing",
      ).length,
      decisores: rows.filter((r) => r.decisor === "Sim").length,
    });
  }, [sdrId, today, supabase]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!sdrId) return;
    const ch = supabase
      .channel("log_sdr_hoje")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "log_sdr" },
        () => fetchMetrics(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, sdrId, fetchMetrics]);

  function update<K extends keyof NovoRegistroInput>(
    key: K,
    value: NovoRegistroInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addRegistro(form);
      if (result.ok) {
        setToast({ type: "success", message: "Registro adicionado!" });
        setForm((prev) => ({ ...prev, lead_result: "" }));
        fetchMetrics();
      } else {
        setToast({ type: "error", message: result.error });
      }
      setTimeout(() => setToast(null), 2800);
    });
  }

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">SDR Menu</h1>
          <p className="mt-1 text-sm text-slate-500">
            Olá, <span className="font-medium text-slate-700">{sdrNome}</span> · registrar
            nova ligação
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/bi"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            Dashboard
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Sair
          </button>
        </div>
      </header>

      {metrics && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Hoje
            </p>
            <span className="text-[10px] text-slate-300">tempo real</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <MiniStat label="Ligações" value={metrics.total} color="#16a34a" />
            <MiniStat label="Atendidas" value={metrics.atendidas} color="#0284c7" />
            <MiniStat label="Marcações" value={metrics.marcacoes} color="#f59e0b" />
            <MiniStat label="Decisores" value={metrics.decisores} color="#7c3aed" />
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Field label="Modalidade Ligação">
          <Select
            value={form.modalidade_ligacao}
            onChange={(v) => update("modalidade_ligacao", v)}
            options={MODALIDADE_OPTIONS}
          />
        </Field>

        <Field label="Resultado Ligação">
          <Select
            value={form.call_result}
            onChange={(v) => update("call_result", v)}
            options={CALL_OPTIONS}
          />
        </Field>

        <Field label="Temperatura Lead">
          <Select
            value={form.temperatura}
            onChange={(v) => update("temperatura", v)}
            options={TEMP_OPTIONS}
          />
        </Field>

        <Field label="Modelo Agendamento">
          <Select
            value={form.modelo_agendamento}
            onChange={(v) => update("modelo_agendamento", v)}
            options={ABERTURA_OPTIONS}
          />
        </Field>

        <Field label="Resultado Lead">
          <Select
            value={form.lead_result ?? ""}
            onChange={(v) => update("lead_result", v)}
            options={LEAD_OPTIONS}
          />
        </Field>

        <Field label="Empresa">
          <Select
            value={form.empresa}
            onChange={(v) => update("empresa", v)}
            options={EMPRESA_OPTIONS}
          />
        </Field>

        <Field label="Nicho Ligação">
          <Select
            value={form.nicho}
            onChange={(v) => update("nicho", v)}
            options={NICHO_OPTIONS}
          />
        </Field>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-400"
        >
          {isPending ? "Enviando..." : "Adicionar registro"}
        </button>
      </form>

      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 mx-auto max-w-md rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </label>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
      <p className="text-2xl font-bold leading-none" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
