"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

export default function BecomeSeller({ userId, label = "Bliv sælger" }: { userId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const { error } = await getSupabase().from("profiles").update({ is_seller: true }).eq("id", userId);
    setBusy(false);
    if (error) return toast(errorText(error));
    toast("Du er nu sælger. Opret dit første show!");
    router.push("/studio");
    router.refresh();
  }
  return (
    <button className="btn btn-red" type="button" onClick={go} disabled={busy}>
      {busy ? "Et øjeblik …" : label}
    </button>
  );
}
