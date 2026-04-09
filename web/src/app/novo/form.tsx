"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRegistro, signOut, type NovoRegistroInput } from "./actions";

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

export default function NovoForm({ sdrNome }: { sdrNome: string }) {
  const router = useRouter();
  const [form, setForm] = useState<NovoRegistroInput>(initialState);
  const [toast, setToast] = useState<Toast>(null);
  const [isPending, startTransition] = useTransition();

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
        <button
          type="button"
          onClick={handleSignOut}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Sair
        </button>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
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
