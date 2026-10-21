"use client";

import { useId, useState } from "react";
import { REPORT_REASONS, REPORT_TARGETS, type ReportReason, type ReportTarget } from "@/lib/reports";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/** "Anmeld": alle kan anmelde en ting, et show eller en profil. Vi afgør det på /admin/anmeldelser. */
export default function ReportButton({ type, id, className = "" }: { type: ReportTarget; id: string; className?: string }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function show() {
    setOpen(true);
    if (loggedIn !== null) return;
    try {
      const { data } = await getSupabase().auth.getSession();
      setLoggedIn(Boolean(data.session));
    } catch {
      setLoggedIn(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return toast("Vælg, hvad der er galt.");
    if (message.trim().length < 10) return toast("Fortæl lidt mere om, hvad der er galt.");
    setBusy(true);
    try {
      const r = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_type: type, target_id: id, reason, message, email }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke at sende anmeldelsen.");
      setSent(true);
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className={`fine report-done ${className}`} role="status">
        Tak. Vi har fået din anmeldelse og kigger på den hurtigst muligt.
      </p>
    );
  }
  if (!open) {
    return (
      <button className={`linkbtn ${className}`} type="button" onClick={show}>
        Anmeld {REPORT_TARGETS[type]}
      </button>
    );
  }
  return (
    <form className={`problem-form report-form ${className}`} onSubmit={send}>
      <fieldset>
        <legend>Hvad er galt med {REPORT_TARGETS[type]}?</legend>
        {(Object.keys(REPORT_REASONS) as ReportReason[]).map((k) => (
          <label key={k}>
            <input type="radio" name={`${uid}-reason`} checked={reason === k} onChange={() => setReason(k)} />
            <span>{REPORT_REASONS[k]}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor={`${uid}-msg`}>Fortæl kort, hvorfor</label>
        <textarea id={`${uid}-msg`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
      </div>
      {loggedIn === false ? (
        <div className="field">
          <label htmlFor={`${uid}-email`}>Din e-mail</label>
          <input id={`${uid}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
      ) : null}
      <p className="fine">
        Sælgeren kan ikke se, hvem der har anmeldt. Du får besked, når vi har afgjort sagen.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-red btn-sm" type="submit" disabled={busy}>{busy ? "Sender …" : "Send anmeldelsen"}</button>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setOpen(false)} disabled={busy}>Fortryd</button>
      </div>
    </form>
  );
}
