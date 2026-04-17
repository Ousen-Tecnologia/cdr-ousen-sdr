import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "./dashboard";
import type { LogRow } from "./actions";

export const dynamic = "force-dynamic";

function defaultRange(): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return [`${y}-${m}-01`, now.toISOString().slice(0, 10)];
}

export default async function BiPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: sdr } = await supabase
    .from("sdrs")
    .select("id, nome, role")
    .eq("user_id", user.id)
    .single();

  const [dateFrom, dateTo] = defaultRange();

  const { data: initialRows, error } = await supabase
    .from("log_sdr")
    .select(
      "id, data_registro, call_result, lead_result, decisor, temperatura, modalidade_ligacao, empresa, nicho",
    )
    .gte("data_registro", dateFrom)
    .lte("data_registro", dateTo)
    .order("data_registro", { ascending: true });

  if (error) {
    console.error("[bi/page] initial fetch error:", error);
  }

  return (
    <Dashboard
      sdrNome={sdr?.nome ?? "SDR"}
      sdrRole={sdr?.role ?? "sdr"}
      initialRows={(initialRows ?? []) as LogRow[]}
      initialRange={[dateFrom, dateTo]}
    />
  );
}
