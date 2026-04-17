"use server";

import { createClient } from "@/lib/supabase/server";

export type LogRow = {
  id: number;
  data_registro: string;
  call_result: string;
  lead_result: string | null;
  decisor: string | null;
  temperatura: string | null;
  modalidade_ligacao: string;
  empresa: string | null;
  nicho: string | null;
};

export async function fetchLogs(
  dateFrom: string,
  dateTo: string,
): Promise<LogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("log_sdr")
    .select(
      "id, data_registro, call_result, lead_result, decisor, temperatura, modalidade_ligacao, empresa, nicho",
    )
    .gte("data_registro", dateFrom)
    .lte("data_registro", dateTo)
    .order("data_registro", { ascending: true });

  if (error) {
    console.error("[bi/fetchLogs] supabase error:", error);
    throw new Error(error.message);
  }
  return (data ?? []) as LogRow[];
}
