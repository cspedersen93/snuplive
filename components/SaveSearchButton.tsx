"use client";

import Link from "next/link";
import { useState } from "react";
import { IconBell } from "@/components/Icons";
import { searchHref, type Search } from "@/lib/search";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import { track } from "@/lib/track";

/**
 * "Giv mig besked om nye": gemmer søgningen som søgeagent. Ikke logget ind: knappen fører til login og tilbage hertil.
 */
export default function SaveSearchButton({ s, signedIn, saved: savedInit = false }: { s: Search; signedIn: boolean; saved?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(savedInit);
  const back = searchHref(s);

  if (!signedIn)
    return (
      <Link className="btn btn-line save-search" href={`/login?next=${encodeURIComponent(back)}`}>
        <IconBell /> Giv mig besked om nye
      </Link>
    );

  if (saved)
    return (
      <span className="save-search-done" role="status">
        <IconBell /> Du får besked, når der kommer nyt. <Link href="/konto#soegeagenter">Se dine søgeagenter</Link>
      </span>
    );

  async function save() {
    setBusy(true);
    const { error } = await getSupabase().rpc("save_search", {
      p_query: s.q,
      p_category: s.category,
      p_max_price: s.maxPrice,
      p_size: s.size,
    });
    setBusy(false);
    if (error) {
      // Før 0024_soegning.sql er kørt i Supabase.
      if (/save_search|function|schema cache/i.test(error.message)) return toast("Søgeagenter er ikke sat op endnu. Prøv igen senere.");
      return toast(errorText(error));
    }
    setSaved(true);
    track("Søgeagent");
    toast("Gemt. Du får besked, når der kommer nyt, der passer.");
  }

  return (
    <button className="btn btn-line save-search" type="button" onClick={save} disabled={busy}>
      <IconBell /> {busy ? "Gemmer …" : "Giv mig besked om nye"}
    </button>
  );
}
