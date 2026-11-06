"use client";

import { useState } from "react";
import { DRAFT_LENGTHS, type DraftLength } from "@/lib/newsletterAi";
import { errorText, toast } from "@/lib/toast";

type To = "all" | "sellers";

/**
 * Nyhedsbrevet: skriv selv, eller få Claude til at skrive et udkast ud fra et par stikord. Send altid en test til dig
 * selv først.
 */
export default function WaitlistMail({
  recipients,
  sellers,
  me,
  aiReady,
}: {
  recipients: number;
  sellers: number;
  me: string;
  aiReady: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [to, setTo] = useState<To>("all");
  const [tested, setTested] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState("");
  const [length, setLength] = useState<DraftLength>("mellem");
  const [writing, setWriting] = useState<"new" | "fix" | null>(null);
  const count = to === "all" ? recipients : sellers;
  const hasDraft = Boolean(subject.trim() && text.trim());

  async function draft(fix: boolean) {
    if (brief.trim().length < 3) return toast(fix ? "Skriv, hvad Claude skal rette." : "Skriv et par ord om, hvad nyhedsbrevet skal handle om.");
    setWriting(fix ? "fix" : "new");
    try {
      const r = await fetch("/api/admin/nyhedsbrev/udkast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, length, current: fix ? { subject, text } : undefined }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; subject?: string; text?: string };
      if (!r.ok || !j.subject || !j.text) throw new Error(j.error || "Claude svarede ikke. Prøv igen.");
      setSubject(j.subject);
      setText(j.text);
      setTested(false);
      if (fix) setBrief("");
      toast("Udkastet er klar. Læs det igennem, og ret det til.");
    } catch (e) {
      toast(errorText(e));
    } finally {
      setWriting(null);
    }
  }

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
    <section className="box news-mail" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="h3">Skriv og send nyhedsbrevet</h2>
      <p className="muted" style={{ fontSize: ".875rem" }}>
        Mailen går kun til dem, der har bekræftet og ikke har afmeldt sig. Et afmeldingslink kommer automatisk med nederst. Send en test til dig selv først.
        {count > 100 ? " Resends gratisplan sender højst 100 mails om dagen, så opgradér, før du sender til flere." : ""}
      </p>

      <div className="ai-writer">
        <div className="ai-writer-head">
          <span className="ai-badge">Claude</span>
          <strong>Skriv med Claude</strong>
        </div>
        {aiReady ? (
          <>
            <p className="muted" style={{ fontSize: ".875rem", margin: 0 }}>
              Skriv med dine egne ord, hvad nyhedsbrevet skal handle om. Claude kender dagens dato, kampagnerne og de næste shows i
              programmet, men finder ikke selv på priser eller løfter. Du kan rette alt bagefter.
            </p>
            <div className="field">
              <label htmlFor="ai-brief">{hasDraft ? "Hvad skal Claude skrive eller rette?" : "Hvad skal nyhedsbrevet handle om?"}</label>
              <textarea
                id="ai-brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                maxLength={1500}
                style={{ minHeight: 90 }}
                placeholder={
                  hasDraft
                    ? "Fx: Gør den kortere, og nævn, at der er budsalg fra 1 kr."
                    : "Fx: Green Friday på fredag kl. 20. 12 sælgere er med, og der er budsalg fra 1 kr. Mind folk om at trykke Husk mig."
                }
              />
            </div>
            <fieldset className="soon-roles">
              <legend>Længde</legend>
              {(Object.keys(DRAFT_LENGTHS) as DraftLength[]).map((k) => (
                <label key={k} className={length === k ? "on" : ""}>
                  <input type="radio" name="ai-length" checked={length === k} onChange={() => setLength(k)} />
                  {DRAFT_LENGTHS[k].label}
                </label>
              ))}
            </fieldset>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-red btn-sm" type="button" disabled={Boolean(writing)} onClick={() => draft(false)}>
                {writing === "new" ? "Claude skriver …" : hasDraft ? "Skriv et nyt udkast" : "Skriv udkast"}
              </button>
              {hasDraft ? (
                <button className="btn btn-line btn-sm" type="button" disabled={Boolean(writing)} onClick={() => draft(true)}>
                  {writing === "fix" ? "Claude retter …" : "Ret udkastet"}
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted" style={{ fontSize: ".875rem", margin: 0 }}>
            Claude er ikke sat op. Læg ANTHROPIC_API_KEY ind i Vercel, og tryk Redeploy. Indtil da kan du skrive selv herunder.
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="wl-subject">Emne</label>
        <input
          id="wl-subject"
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setTested(false); }}
          maxLength={150}
          placeholder="Fx: Green Friday i aften kl. 20"
        />
      </div>
      <div className="field">
        <label htmlFor="wl-text">Tekst</label>
        <textarea
          id="wl-text"
          value={text}
          onChange={(e) => { setText(e.target.value); setTested(false); }}
          maxLength={5000}
          style={{ minHeight: 220 }}
          placeholder={"Hej\n\n…\n\nHilsen Relived"}
        />
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
