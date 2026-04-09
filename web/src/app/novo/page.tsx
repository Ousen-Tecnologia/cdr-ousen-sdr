import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NovoForm from "./form";

export default async function NovoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: sdr } = await supabase
    .from("sdrs")
    .select("nome")
    .eq("user_id", user.id)
    .single();

  return <NovoForm sdrNome={sdr?.nome ?? user.email ?? "SDR"} />;
}
