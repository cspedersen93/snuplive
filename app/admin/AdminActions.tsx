"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

type Action = "refund" | "release" | "close";

const TEXT: Record<Action, { button: string; ask: string; done: string }> = {
  refund: { button: "Refundér køberen", ask: "Køberen får alle pengene tilbage, og tingene kan sælges igen.", done: "Køberen har fået pengene tilbage." },
  release: { button: "Send pengene til sælgeren", ask: "Ordren afsluttes, og sælgeren får pengene.", done: "Pengene er sendt til sælgeren." },
  close: { button: "Luk sagen", ask: "Sagen lukkes uden at flytte penge. Ordren afsluttes derefter som normalt.", done: "Sagen er lukket." },
};

export default function AdminActions({ orderId, refundText, releaseText, canRelease }: { orderId: string; refundText: string; releaseText: string; canRelease: boolean }) {
  const router = useRouter();
  const [ask, setAsk] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/orders/${orderId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke.");
      toast(TEXT[action].done);
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
      setAsk(null);
    }
  }

  if (ask) {
    return (
      <div className="confirm-ask">
        <span>{TEXT[ask].ask} Det kan ikke fortrydes.</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-red btn-sm" type="button" onClick={() => run(ask)} disabled={busy}>
            {busy ? "Arbejder …" : "Ja, gør det"}
          </button>
          <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(null)} disabled={busy}>Fortryd</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className="btn btn-red btn-sm" type="button" onClick={() => setAsk("refund")}>{TEXT.refund.button} ({refundText})</button>
      {canRelease ? (
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk("release")}>{TEXT.release.button} ({releaseText})</button>
      ) : null}
      <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk("close")}>{TEXT.close.button}</button>
    </div>
  );
}
