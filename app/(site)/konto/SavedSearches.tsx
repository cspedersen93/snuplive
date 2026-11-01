"use client";

import Link from "next/link";
import { useState } from "react";
import { searchHref, searchLabel } from "@/lib/search";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

export interface SavedSearch {
  id: string;
  query: string;
  category: string | null;
  max_price: number | null;
  size: string | null;
}

/** Min konto → Dine søgeagenter: se og slet de gemte søgninger. */
export default function SavedSearches({ initial }: { initial: SavedSearch[] }) {
  const [list, setList] = useState(initial);

  async function remove(id: string) {
    const { error } = await getSupabase().from("saved_searches").delete().eq("id", id);
    if (error) return toast(errorText(error));
    setList((l) => l.filter((x) => x.id !== id));
    toast("Søgeagenten er slettet.");
  }

  return (
    <div className="box" id="soegeagenter">
      <h2 className="h3" style={{ marginBottom: 8 }}>Dine søgeagenter</h2>
      {list.length ? (
        <>
          <p className="muted" style={{ fontSize: ".95rem", marginBottom: 6 }}>
            Du får besked, når der kommer en ny vare, der passer. Med besked på telefonen slået til kommer den der, ellers på mail.
          </p>
          <ul className="saved-list">
            {list.map((s) => (
              <li key={s.id}>
                <Link href={searchHref({ q: s.query, category: s.category, maxPrice: s.max_price, size: s.size })}>{searchLabel(s)}</Link>
                <button className="linkbtn" type="button" onClick={() => remove(s.id)} aria-label={`Slet søgeagenten ${searchLabel(s)}`}>
                  Slet
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted" style={{ fontSize: ".95rem" }}>
          Du har ingen søgeagenter. <Link href="/soeg">Søg</Link> efter det, du leder efter, og tryk <b>Giv mig besked om nye</b>.
        </p>
      )}
    </div>
  );
}
