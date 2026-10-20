"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

export function ShipForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabase().rpc("mark_shipped", { p_order: orderId, p_carrier: carrier, p_tracking: tracking });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast("Pakken er markeret som sendt. Køberen kan nu bekræfte modtagelsen.");
    router.refresh();
  }
  return (
    <form className="ship-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor={`c-${orderId}`}>Fragtfirma (valgfrit)</label>
        <input id={`c-${orderId}`} value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={40} placeholder="Fx GLS" />
      </div>
      <div className="field">
        <label htmlFor={`t-${orderId}`}>Sporingsnummer (valgfrit)</label>
        <input id={`t-${orderId}`} value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} />
      </div>
      <button className="btn btn-red btn-sm" type="submit" disabled={busy}>{busy ? "Gemmer …" : "Markér som sendt"}</button>
    </form>
  );
}

export function RefundButton({ orderId, amount }: { orderId: string; amount: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function refund() {
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/refund`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Refunderingen fejlede.");
      toast("Ordren er annulleret, og køberen får pengene tilbage.");
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
      <button className="linkbtn" type="button" onClick={() => setAsk(true)}>
        Kan ikke levere? Annullér og refundér
      </button>
    );
  }
  return (
    <div className="confirm-ask">
      <span>Køberen får {amount} tilbage, og tingene kan sælges igen. Det kan ikke fortrydes.</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-red btn-sm" type="button" onClick={refund} disabled={busy}>{busy ? "Refunderer …" : "Ja, refundér"}</button>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(false)} disabled={busy}>Fortryd</button>
      </div>
    </div>
  );
}

export function CancelReservation({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function cancel() {
    setBusy(true);
    const { error } = await getSupabase().rpc("cancel_reservation", { p_sale: saleId });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast("Snuppet er annulleret, og tingen kan sælges igen.");
    router.refresh();
  }
  return (
    <button className="linkbtn" type="button" onClick={cancel} disabled={busy}>
      {busy ? "Annullerer …" : "Annullér"}
    </button>
  );
}
