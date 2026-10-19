"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { hasSupabase } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { errorText } from "@/lib/toast";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthForm({ cta = "Send login-link" }: { cta?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next") ?? "/konto";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/konto";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(params.get("fejl") ? "Linket er udløbet eller allerede brugt. Bed om et nyt." : null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!EMAIL.test(addr)) return setErr("Skriv en gyldig e-mailadresse, fx navn@mail.dk.");
    if (!hasSupabase) return setErr("Login er ikke sat op endnu.");
    setBusy(true);
    setErr(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      email: addr,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) {
      setErr(/rate limit|seconds/i.test(error.message) ? "Vent et øjeblik, før du beder om en ny mail." : errorText(error));
      return;
    }
    setEmail(addr);
    setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) return setErr("Koden står i mailen og består af tal.");
    setBusy(true);
    setErr(null);
    const { error } = await getSupabase().auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error) return setErr("Koden passer ikke eller er udløbet. Prøv igen, eller bed om en ny mail.");
    router.replace(next);
    router.refresh();
  }

  if (sent) {
    return (
      <form onSubmit={verify} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="status">
          Vi har sendt en mail til <b>{email}</b>. Tryk på linket i mailen, eller skriv koden herunder.
        </div>
        <div className="field">
          <label htmlFor="otp">Kode fra mailen</label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            aria-invalid={Boolean(err)}
          />
        </div>
        {err ? <p className="err" role="alert">{err}</p> : null}
        <button className="btn btn-red btn-block" type="submit" disabled={busy}>
          {busy ? "Logger ind …" : "Log ind"}
        </button>
        <button className="linkbtn" type="button" onClick={() => { setSent(false); setCode(""); setErr(null); }}>
          Brug en anden e-mail
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={send} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErr(null); }}
          placeholder="navn@mail.dk"
          aria-invalid={Boolean(err)}
        />
      </div>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <button className="btn btn-red btn-block" type="submit" disabled={busy}>
        {busy ? "Sender …" : cta}
      </button>
      <p className="fine">
        Vi sender et link og en kode til din mail, så du ikke skal huske en adgangskode. Har du ikke en konto, opretter vi
        den. Ved at fortsætte accepterer du vores <a href="/privatliv">privatlivspolitik</a>.
      </p>
    </form>
  );
}
