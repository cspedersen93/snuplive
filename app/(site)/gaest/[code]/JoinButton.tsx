"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/** "Ja, vær med": gæsten kommer med i showet og lander i studiet. */
export default function JoinButton({ code, hostHandle }: { code: string; hostHandle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function join() {
    setBusy(true);
    const { data, error } = await getSupabase().rpc("guest_join", { p_code: code });
    if (error || typeof data !== "string") {
      setBusy(false);
      return toast(errorText(error ?? new Error("Det virkede ikke. Prøv igen.")));
    }
    toast(`Du er med i @${hostHandle}s show.`);
    router.push(`/studio/${data}`);
  }
  return (
    <button className="btn btn-red" type="button" onClick={join} disabled={busy} style={{ alignSelf: "flex-start" }}>
      {busy ? "Et øjeblik …" : "Ja, vær med"}
    </button>
  );
}
