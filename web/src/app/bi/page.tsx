import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

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

  return <Dashboard sdrNome={sdr?.nome ?? "SDR"} sdrRole={sdr?.role ?? "sdr"} />;
}
