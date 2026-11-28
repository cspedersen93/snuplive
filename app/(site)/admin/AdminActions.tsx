"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

type Action = "refund" | "release" | "close" | "return" | "cover" | "shipped";

const TEXT: Record<Action, { button: string; ask: string; done: string }> = {
  refund: { button: "Refundér køberen", ask: "Køberen får alle pengene tilbage, og varerne kan sælges igen.", done: "Køberen har fået pengene tilbage." },
  release: { button: "Send pengene til sælgeren", ask: "Ordren afsluttes, og sælgeren får pengene.", done: "Pengene er sendt til sælgeren." },
  return: {
    button: "Bed om varen retur",
    ask: "Køberen får besked om at sende varen retur og får en returlabel, hvis ordren blev sendt til en pakkeshop. Når køberen har sendt pakken, bliver returfragten trukket fra sælgerens næste udbetaling. Pengene holdes tilbage, indtil du refunderer.",
    done: "Køberen har fået besked om at sende varen retur.",
  },
  cover: {
    button: "Relived dækker",
    ask: "Køberen får alle pengene tilbage, og sælgeren får sin udbetaling alligevel. Tabet er Reliveds.",
    done: "Køberen har fået pengene tilbage, og sælgeren har fået sin udbetaling.",
  },
  close: { button: "Luk sagen", ask: "Sagen lukkes uden at flytte penge. Ordren afsluttes derefter som normalt.", done: "Sagen er lukket." },
  shipped: {
    button: "Markér som sendt",
    ask: "Ordren bliver markeret som sendt, selv om sporingen ikke har registreret pakken. Køberen kan bekræfte modtagelsen eller melde et problem. Ellers afsluttes ordren efter 7 dage, og sælgeren får pengene.",
    done: "Ordren er markeret som sendt.",
  },
};

export default function AdminActions({
  orderId,
  refundText,
  releaseText,
  canRelease,
  canReturn = false,
  canCover = false,
  coverText = "",
  coverPending = false,
  canClose = true,
  canShip = false,
}: {
  orderId: string;
  refundText: string;
  releaseText: string;
  canRelease: boolean;
  /** 0039 er kørt, og der er ikke bedt om retur endnu. */
  canReturn?: boolean;
  canCover?: boolean;
  coverText?: string;
  /** Sælgeren har fået sin udbetaling, men refusionen til køberen mangler. Så er det den eneste knap. */
  coverPending?: boolean;
  /** Der er en sag at lukke. En afhentning uden sag har kun de to knapper, der flytter penge. */
  canClose?: boolean;
  /** En pakke med Reliveds label, som ikke er scannet: kan markeres som sendt i hånden. */
  canShip?: boolean;
}) {
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
  if (coverPending) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-red btn-sm" type="button" onClick={() => run("cover")} disabled={busy}>
          {busy ? "Arbejder …" : `Gør færdig: refundér køberen (${refundText})`}
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className="btn btn-red btn-sm" type="button" onClick={() => setAsk("refund")}>{TEXT.refund.button} ({refundText})</button>
      {canShip ? (
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk("shipped")}>{TEXT.shipped.button}</button>
      ) : null}
      {canRelease ? (
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk("release")}>{TEXT.release.button} ({releaseText})</button>
      ) : null}
      {canReturn ? (
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk("return")}>{TEXT.return.button}</button>
      ) : null}
      {canCover ? (
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk("cover")}>{TEXT.cover.button} ({coverText})</button>
      ) : null}
      {canClose ? (
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk("close")}>{TEXT.close.button}</button>
      ) : null}
    </div>
  );
}
