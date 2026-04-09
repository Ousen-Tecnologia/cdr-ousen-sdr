"use server";

import { createClient } from "@/lib/supabase/server";

export type NovoRegistroInput = {
  call_result: string;
  lead_result: string | null;
  temperatura: string;
  modelo_agendamento: string;
  empresa: string;
  nicho: string;
};

export type NovoRegistroResult =
  | { ok: true }
  | { ok: false; error: string };

export async function addRegistro(
  input: NovoRegistroInput,
): Promise<NovoRegistroResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  const { data: sdr, error: sdrError } = await supabase
    .from("sdrs")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (sdrError || !sdr) {
    return {
      ok: false,
      error: "Seu usuário não está vinculado a um SDR no banco.",
    };
  }

  const today = new Date();
  const dataRegistro = today.toISOString().slice(0, 10);

  const { error } = await supabase.from("log_sdr").insert({
    data_registro: dataRegistro,
    sdr_id: sdr.id,
    call_result: input.call_result,
    lead_result: input.lead_result || null,
    temperatura: input.temperatura,
    modelo_agendamento: input.modelo_agendamento,
    empresa: input.empresa,
    nicho: input.nicho,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
