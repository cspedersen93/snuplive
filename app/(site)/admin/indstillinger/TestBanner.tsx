"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

type Mode = "auto" | "on" | "off";

/** TESTFASE-bjælken øverst: automatisk (følger betalingen), altid vist eller skjult. */
export default function TestBanner({ mode, test }: { mode: Mode; test: boolean }) {
  const router = useRouter();
  const [cur, setCur] = useState<Mode>(mode);
  const [busy, setBusy] = useState(false);
  const shown = cur === "auto" ? test : cur === "on";

  async function choose(next: Mode) {
    if (next === cur) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "test_banner", value: next === "auto" ? null : next === "on" }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke at gemme.");
      setCur(next);
      const willShow = next === "auto" ? test : next === "on";
      toast(willShow ? "TESTFASE vises øverst på siden." : "TESTFASE er fjernet fra siden.");
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const opt = (m: Mode, label: string) => (
    <label>
      <input type="radio" name="test-banner" checked={cur === m} disabled={busy} onChange={() => choose(m)} />
      <span>{label}</span>
    </label>
  );
  return (
    <div className="test-banner-set" data-setting="test_banner">
      <fieldset className="seg sale-seg">
        <legend className="sr-only">TESTFASE-bjælken</legend>
        {opt("auto", "Automatisk")}
        {opt("on", "Vis")}
        {opt("off", "Skjul")}
      </fieldset>
      <p className="muted" style={{ fontSize: ".9rem" }}>
        <b>Lige nu {shown ? "vises" : "vises ikke"} TESTFASE.</b>{" "}
        {cur === "auto"
          ? test
            ? "Automatisk: den vises, så længe betalingen kører i testtilstand, og forsvinder, når I skifter til rigtige Stripe-nøgler."
            : "Automatisk: betalingen er rigtig, så den vises ikke."
          : cur === "on"
            ? "I har valgt at vise den, uanset betalingen."
            : "I har valgt at skjule den, uanset betalingen."}
      </p>
      {cur === "on" && !test ? (
        <p className="notice" style={{ margin: 0 }}>
          <span>Betalingen er rigtig nu, men bjælken siger stadig, at alt er en test. Vælg Automatisk eller Skjul.</span>
        </p>
      ) : null}
    </div>
  );
}
