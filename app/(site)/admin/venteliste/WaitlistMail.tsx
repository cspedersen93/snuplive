"use client";

import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

type To = "all" | "sellers";

/** Mail til ventelisten, fx når SnupLive åbner. Send altid en test til dig selv først. */
export default function WaitlistMail({ recipients, sellers, me }: { recipients: number; sellers: number; me: string }) {
  const [subject, setSubject] = useState("SnupLive er åben!");
  const [text, setText] = useState(
    "Hej\n\nNu er SnupLive åben. Se hvem der er live, og snup brugt tøj, design og samleobjekter på video:\nhttps://snuplive.dk\n\nHilsen SnupLive",
  );
  const [to, setTo] = useState<To>("all");
  const [tested, setTested] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = to === "all" ? recipients : sellers;

  async function send(test: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/venteliste/mail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, text, to, test }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; sent?: number };
      if (!r.ok) throw new Error(j.error || "Mailen blev ikke sendt.");
      if (test) {
        setTested(true);
        toast(`Testmailen er sendt til ${me}.`);
      } else toast(`Sendt til ${j.sent ?? 0} ${j.sent === 1 ? "person" : "personer"}.`);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
      setAsk(false);
    }
  }

  return (
    <section className="box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="h3">Send en mail til ventelisten</h2>
      <p className="muted" style={{ fontSize: ".9rem" }}>
        Mailen går kun til dem, der har bekræftet og ikke har afmeldt sig. Et afmeldingslink kommer automatisk med nederst. Send en test til dig selv først.
        {count > 100 ? " Resends gratisplan sender højst 100 mails om dagen, så opgradér, før du sender til flere." : ""}
      </p>
      <div className="field">
        <label htmlFor="wl-subject">Emne</label>
        <input id="wl-subject" value={subject} onChange={(e) => { setSubject(e.target.value); setTested(false); }} maxLength={150} />
      </div>
      <div className="field">
        <label htmlFor="wl-text">Tekst</label>
        <textarea id="wl-text" value={text} onChange={(e) => { setText(e.target.value); setTested(false); }} maxLength={5000} style={{ minHeight: 160 }} />
      </div>
      <fieldset className="soon-roles" style={{ marginTop: 2 }}>
        <legend>Send til</legend>
        <label className={to === "all" ? "on" : ""}>
          <input type="radio" name="wl-to" checked={to === "all"} onChange={() => setTo("all")} />
          Alle bekræftede ({recipients})
        </label>
        <label className={to === "sellers" ? "on" : ""}>
          <input type="radio" name="wl-to" checked={to === "sellers"} onChange={() => setTo("sellers")} />
          Kun dem, der vil sælge ({sellers})
        </label>
      </fieldset>
      {ask ? (
        <div className="confirm-ask">
          <span>Send mailen til {count} {count === 1 ? "person" : "personer"} nu? Det kan ikke fortrydes.</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-red btn-sm" type="button" disabled={busy} onClick={() => send(false)}>{busy ? "Sender …" : "Ja, send den"}</button>
            <button className="btn btn-line btn-sm" type="button" disabled={busy} onClick={() => setAsk(false)}>Fortryd</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-line btn-sm" type="button" disabled={busy || !subject.trim() || !text.trim()} onClick={() => send(true)}>
            Send en test til mig
          </button>
          <button className="btn btn-red btn-sm" type="button" disabled={busy || !tested || !count} onClick={() => setAsk(true)} title={tested ? undefined : "Send en test først"}>
            Send til {count} {count === 1 ? "person" : "personer"}
          </button>
        </div>
      )}
    </section>
  );
}
