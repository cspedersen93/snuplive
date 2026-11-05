"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { errorText, toast } from "@/lib/toast";
import { track } from "@/lib/track";

/**
 * Tilmelding til nyhedsbrevet. Bruger samme liste som ventelisten (tabellen waitlist) med dobbelt tilmelding:
 * man får en mail og er først med, når man har trykket på linket. `source` fortæller, hvor man skrev sig op.
 */
export default function NewsletterForm({
  source,
  button = "Skriv mig op",
  sellOption = true,
}: {
  source: string;
  button?: string;
  /** Fluebenet "Jeg vil også gerne sælge". Skjult i de små felter på tomme sider. */
  sellOption?: boolean;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [sell, setSell] = useState(false);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return toast("Skriv en gyldig e-mail.");
    if (!consent) return toast("Sæt flueben, så vi må sende dig nyhedsbrevet.");
    setBusy(true);
    try {
      const r = await fetch("/api/venteliste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role: sell ? "both" : "buyer", consent, website, source }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke at skrive dig op.");
      setSent(email.trim().toLowerCase());
      track("Nyhedsbrev", { sted: source, saelger: sell });
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="soon-done news-done" role="status">
        <strong>Tjek din mail</strong>
        <p>
          Vi har sendt en mail til <b>{sent}</b>. Tryk på linket i mailen, så får du nyhedsbrevet. Kig også i spam, hvis den ikke
          dukker op.
        </p>
      </div>
    );
  }
  return (
    <form className="soon-form news-form" onSubmit={send} noValidate>
      <div className="soon-row">
        <label className="sr-only" htmlFor={`${id}-email`}>Din e-mail</label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Din e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          required
        />
        <button className="btn btn-red" type="submit" disabled={busy}>{busy ? "Et øjeblik …" : button}</button>
      </div>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Ja tak, send mig Relived-nyhedsbrevet med nye shows, kampagner og gode fund. Du kan altid afmelde dig.{" "}
          <Link href="/privatliv">Sådan passer vi på dine oplysninger</Link>
        </span>
      </label>
      {sellOption ? (
        <label className="check">
          <input type="checkbox" checked={sell} onChange={(e) => setSell(e.target.checked)} />
          <span>Jeg vil også gerne sælge i showene. Så kontakter vi dig.</span>
        </label>
      ) : null}
      {/* Felt, som kun robotter udfylder. */}
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
    </form>
  );
}
