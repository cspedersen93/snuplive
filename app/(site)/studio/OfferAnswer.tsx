"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { kr } from "@/lib/format";
import { errorText, toast } from "@/lib/toast";

/** Ja eller nej til et bud. Køberen får besked. */
export default function OfferAnswer({ id, amount, handle }: { id: string; amount: number; handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function answer(accept: boolean) {
    setBusy(true);
    try {
      const r = await fetch(`/api/offers/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Svaret kunne ikke gemmes.");
      toast(
        accept
          ? `Solgt til @${handle} for ${kr(amount)}. Køberen får besked og betaler under Mine køb.`
          : `Du har sagt nej. @${handle} får besked.`,
      );
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="row-actions offer-answer">
      <button className="btn btn-red btn-sm" type="button" onClick={() => answer(true)} disabled={busy}>
        Sig ja
      </button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => answer(false)} disabled={busy}>
        Nej tak
      </button>
    </div>
  );
}
