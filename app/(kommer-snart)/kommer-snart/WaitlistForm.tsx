"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { errorText, toast } from "@/lib/toast";
import { track } from "@/lib/track";

type Role = "buyer" | "seller" | "both";
const ROLES: { k: Role; label: string }[] = [
  { k: "buyer", label: "Købe" },
  { k: "seller", label: "Sælge" },
  { k: "both", label: "Begge dele" },
];

/** Tilmelding til ventelisten. Man får en mail og bekræfter (dobbelt tilmelding). */
export default function WaitlistForm() {
  const id = useId();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("buyer");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  // "Skriv mig op som sælger" længere nede vælger Sælge.
  const wanted = sp.get("rolle");
  useEffect(() => {
    if (wanted === "saelger") setRole("seller");
  }, [wanted]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return toast("Skriv en gyldig e-mail.");
    if (!consent) return toast("Sæt flueben, så vi må sende dig en mail, når vi åbner.");
    setBusy(true);
    try {
      const r = await fetch("/api/venteliste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role, consent, website, source: wanted === "saelger" ? "saelger-knap" : "forside" }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke at skrive dig op.");
      setSent(email.trim().toLowerCase());
      track("Venteliste", { rolle: role });
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="soon-done" id="tilmeld" role="status">
        <strong>Tjek din mail</strong>
        <p>
          Vi har sendt en mail til <b>{sent}</b>. Tryk på linket i mailen, så er du med på listen. Kig også i spam, hvis den ikke dukker op.
        </p>
      </div>
    );
  }
  return (
    <form className="soon-form" id="tilmeld" onSubmit={send} noValidate>
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
        <button className="btn btn-red" type="submit" disabled={busy}>{busy ? "Et øjeblik …" : "Skriv mig op"}</button>
      </div>
      <fieldset className="soon-roles">
        <legend>Jeg vil gerne</legend>
        {ROLES.map((r) => (
          <label key={r.k} className={role === r.k ? "on" : ""}>
            <input type="radio" name={`${id}-role`} checked={role === r.k} onChange={() => setRole(r.k)} />
            {r.label}
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Ja tak, send mig en mail, når Relived åbner, og nyheder om Relived. Du kan altid afmelde dig.{" "}
          <Link href="/privatliv">Sådan passer vi på dine oplysninger</Link>
        </span>
      </label>
      {/* Felt, som kun robotter udfylder. */}
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
    </form>
  );
}
