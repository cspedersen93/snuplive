"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ISSUE_REASONS, type IssueReason } from "@/lib/issues";
import { errorText, toast } from "@/lib/toast";

/** "Meld et problem": køberen fortæller, hvad der er galt, og pengene holdes tilbage. */
export default function ReportProblem({ orderId, business = false }: { orderId: string; business?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<IssueReason | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return toast("Vælg, hvad problemet er.");
    if (message.trim().length < 10) return toast("Skriv lidt mere om, hvad der er galt.");
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/problem`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, message }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke at melde problemet.");
      toast("Tak. Vi holder pengene tilbage og vender tilbage på mail.");
      router.refresh();
    } catch (err) {
      toast(errorText(err));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="linkbtn" type="button" onClick={() => setOpen(true)}>
        Er der et problem med ordren? Meld det her
      </button>
    );
  }
  return (
    <form className="problem-form" onSubmit={send}>
      <fieldset>
        <legend>Hvad er problemet?</legend>
        {/* Fortrydelse gælder kun ved køb fra en virksomhed. */}
        {(Object.keys(ISSUE_REASONS) as IssueReason[]).filter((k) => business || k !== "withdrawal").map((k) => (
          <label key={k}>
            <input type="radio" name={`issue-${orderId}`} checked={reason === k} onChange={() => setReason(k)} />
            <span>{ISSUE_REASONS[k]}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor={`issue-msg-${orderId}`}>Fortæl kort, hvad der er sket</label>
        <textarea
          id={`issue-msg-${orderId}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          placeholder="Fx: Kjolen har en plet på ryggen, som ikke blev vist i showet."
        />
      </div>
      <p className="fine">Pengene holdes tilbage hos Relived, indtil sagen er afgjort. Sælgeren kan se, hvad du skriver.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-red btn-sm" type="submit" disabled={busy}>{busy ? "Sender …" : "Meld problemet"}</button>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setOpen(false)} disabled={busy}>Fortryd</button>
      </div>
    </form>
  );
}
