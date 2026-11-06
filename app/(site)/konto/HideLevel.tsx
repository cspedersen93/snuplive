"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/** Køberen bestemmer selv, om andre kan se køberniveauet og købermærkerne (0032_niveauer.sql). */
export default function HideLevel({ uid, hidden }: { uid: string; hidden: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState(!hidden);
  const [busy, setBusy] = useState(false);
  async function change(next: boolean) {
    setBusy(true);
    const { error } = await getSupabase().from("profiles").update({ hide_buyer_level: !next }).eq("id", uid);
    setBusy(false);
    if (error) return toast(errorText(error));
    setShow(next);
    toast(next ? "Andre kan nu se dit køberniveau." : "Dit køberniveau er skjult for andre.");
    router.refresh();
  }
  return (
    <label className="check" style={{ marginTop: 14 }}>
      <input type="checkbox" checked={show} disabled={busy} onChange={(e) => change(e.target.checked)} />
      <span>
        Vis mit køberniveau og mine købermærker ved mit navn
        <span className="muted" style={{ display: "block", fontSize: ".875rem", marginTop: 2 }}>
          Andre ser kun niveauet, aldrig hvad eller hvor meget du har købt.
        </span>
      </span>
    </label>
  );
}
