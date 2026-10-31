"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

export default function ConfirmReceived({ orderId, pickup }: { orderId: string; pickup: boolean }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke.");
      toast("Tak! Pengene sendes nu til sælgeren.");
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
      setAsk(false);
    }
  }

  if (!ask) {
    return (
      <button className="btn btn-red btn-sm" type="button" onClick={() => setAsk(true)}>
        {pickup ? "Jeg har hentet mine varer" : "Jeg har fået mine varer"}
      </button>
    );
  }
  return (
    <div className="confirm-ask">
      <span>Er alt, som det blev vist i showet? Når du bekræfter, får sælgeren pengene.</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-red btn-sm" type="button" onClick={confirm} disabled={busy}>
          {busy ? "Et øjeblik …" : "Ja, alt er i orden"}
        </button>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(false)} disabled={busy}>
          Fortryd
        </button>
      </div>
    </div>
  );
}
