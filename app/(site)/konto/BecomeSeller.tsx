"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import type { Profile, SellerType } from "@/lib/types";

type Props = {
  /** Når man allerede er sælger, kan man skifte mellem privat og erhverv. */
  profile?: Pick<Profile, "is_seller" | "seller_type" | "business_name" | "business_cvr" | "seller_terms_at">;
  label?: string;
  /** Hvor man kommer hen bagefter (ellers Mine shows). */
  next?: string;
};

/**
 * Bliv sælger: privat eller erhverv (forbrugeraftaleloven § 8 a) og accept af vilkårene.
 * Kalder become_seller i databasen. Bruges også til at skifte sælgertype under Min konto.
 */
export default function BecomeSeller({ profile, label = "Bliv sælger", next }: Props) {
  const router = useRouter();
  const id = useId();
  const change = Boolean(profile?.is_seller);
  const [type, setType] = useState<SellerType | null>(profile?.seller_type ?? null);
  const [name, setName] = useState(profile?.business_name ?? "");
  const [cvr, setCvr] = useState(profile?.business_cvr ?? "");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  // Sælgere fra før vilkårene skal også sige ja til dem.
  const askTerms = !profile?.seller_terms_at;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!type) return toast("Vælg, om du sælger som privatperson eller virksomhed.");
    const digits = cvr.replace(/\D/g, "");
    if (type === "business" && name.trim().length < 2) return toast("Skriv firmanavnet.");
    if (type === "business" && digits.length !== 8) return toast("CVR-nummeret skal have 8 cifre.");
    if (askTerms && !terms) return toast("Sæt flueben ved vilkårene for at fortsætte.");
    setBusy(true);
    const { error } = await getSupabase().rpc("become_seller", {
      p_type: type,
      p_business_name: type === "business" ? name.trim() : null,
      p_cvr: type === "business" ? digits : null,
    });
    setBusy(false);
    if (error) return toast(errorText(error));
    if (change) {
      toast("Dine sælgeroplysninger er gemt.");
      router.refresh();
      return;
    }
    toast(next ? "Du er nu sælger." : "Du er nu sælger. Opret dit første show!");
    router.push(next ?? "/studio");
    router.refresh();
  }

  return (
    <form className="seller-form" onSubmit={save}>
      <fieldset>
        <legend>Sælger du som privatperson eller virksomhed?</legend>
        <label className={`seller-opt${type === "private" ? " on" : ""}`}>
          <input type="radio" name={`${id}-type`} checked={type === "private"} onChange={() => setType("private")} />
          <span>
            <b>Privatperson</b>
            <span className="muted">Du sælger dine egne brugte ting.</span>
          </span>
        </label>
        <label className={`seller-opt${type === "business" ? " on" : ""}`}>
          <input type="radio" name={`${id}-type`} checked={type === "business"} onChange={() => setType("business")} />
          <span>
            <b>Virksomhed</b>
            <span className="muted">Du har købt tingene for at sælge dem igen, eller du sælger jævnligt for at tjene penge.</span>
          </span>
        </label>
      </fieldset>

      {type === "business" ? (
        <div className="seller-biz">
          <div className="field">
            <label htmlFor={`${id}-name`}>Firmanavn</label>
            <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="organization" required />
          </div>
          <div className="field">
            <label htmlFor={`${id}-cvr`}>CVR-nummer</label>
            <input
              id={`${id}-cvr`}
              value={cvr}
              onChange={(e) => setCvr(e.target.value)}
              inputMode="numeric"
              maxLength={11}
              placeholder="8 cifre"
              required
            />
          </div>
          <p className="fine">
            Køberne kan se firmanavn og CVR-nummer. Køb fra en virksomhed har 14 dages fortrydelsesret og 2 års reklamationsret.
          </p>
        </div>
      ) : null}

      {askTerms ? (
        <label className="check">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>
            Jeg accepterer <Link href="/vilkaar" target="_blank">vilkårene for sælgere</Link>.
          </span>
        </label>
      ) : null}

      <div>
        <button className="btn btn-red" type="submit" disabled={busy}>
          {busy ? "Et øjeblik …" : change ? "Gem" : label}
        </button>
      </div>
    </form>
  );
}
