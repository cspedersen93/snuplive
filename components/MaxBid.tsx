"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { nextBid } from "@/lib/auction";
import { hasSupabase } from "@/lib/env";
import { kr } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import { track } from "@/lib/track";

interface AuctionItem {
  id: string;
  price: number;
  seller_id: string;
  high_bid?: number | null;
  high_bidder?: string | null;
  auction_ends_at?: string | null;
}

/**
 * Maks-bud (0025_maksbud.sql): køberen sætter sit højeste bud, og siden byder for køberen i trin, når andre byder.
 * Vises ikke, før migrationen er kørt (eller hvis køberen er sælgeren).
 */
export default function MaxBid({ item, loginHref, compact = false }: { item: AuctionItem; loginHref: string; compact?: boolean }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [mine, setMine] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = getSupabase();
    let alive = true;
    void (async () => {
      const { data } = await sb.auth.getSession();
      const id = data.session?.user.id ?? null;
      if (!alive) return;
      setUid(id);
      if (!id) {
        // Uden login: vis "Log ind og sæt et maks-bud" (efter login skjules det igen, hvis maks-bud ikke er sat op endnu).
        setReady(true);
        return;
      }
      const { data: row, error } = await sb.from("max_bids").select("amount").eq("item_id", item.id).maybeSingle();
      if (!alive) return;
      setReady(!error);
      setMine((row as { amount?: number } | null)?.amount ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [item.id]);

  if (!ready || uid === undefined || uid === item.seller_id) return null;

  const leading = Boolean(uid && item.high_bidder === uid);
  const min = leading ? (item.high_bid ?? item.price) : item.auction_ends_at ? nextBid(item.price, item.high_bid) : item.price;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(value.replace(/[^\d]/g, ""));
    if (!Number.isInteger(n) || n < min) return toast(`Dit maks-bud skal være mindst ${kr(min)}.`);
    setBusy(true);
    const { error } = await getSupabase().rpc("set_max_bid", { p_item: item.id, p_amount: n });
    setBusy(false);
    if (error) return toast(errorText(error));
    setMine(n);
    setOpen(false);
    track("Maks-bud");
    toast(`Dit maks-bud er ${kr(n)}. Vi byder for dig, når andre byder.`);
  }

  async function remove() {
    setBusy(true);
    const { error } = await getSupabase().rpc("clear_max_bid", { p_item: item.id });
    setBusy(false);
    if (error) return toast(errorText(error));
    setMine(null);
    toast("Dit maks-bud er fjernet. Bud, der allerede er givet, står ved magt.");
  }

  return (
    <div className={compact ? "maxbid compact" : "maxbid"}>
      {uid === null ? (
        <p>
          <Link href={loginHref}>Log ind og sæt et maks-bud</Link>. Så byder vi for dig, hvis du ikke selv kan være med.
        </p>
      ) : mine && !open ? (
        <p>
          Dit maks-bud: <b>{kr(mine)}</b>{" "}
          <button className="linkbtn" type="button" onClick={() => { setValue(String(mine)); setOpen(true); }}>Ret</button>{" "}
          <button className="linkbtn" type="button" onClick={remove} disabled={busy}>Fjern</button>
        </p>
      ) : open ? (
        <form className="maxbid-form" onSubmit={save}>
          <label htmlFor={`mb-${item.id}`}>Dit maks-bud (kr)</label>
          <div className="maxbid-row">
            <input id={`mb-${item.id}`} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Mindst ${min}`} autoFocus />
            <button className="btn btn-red btn-sm" type="submit" disabled={busy}>{busy ? "Gemmer …" : "Gem"}</button>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setOpen(false)}>Fortryd</button>
          </div>
        </form>
      ) : (
        <button className="btn btn-line btn-sm maxbid-open" type="button" onClick={() => { setValue(""); setOpen(true); }}>
          Sæt maks-bud
        </button>
      )}
      <p className="fine">
        Siden byder for dig i trin, når andre byder, op til dit maks-bud. Ingen kan se det. Vinder du, betaler du kun ét trin over
        det næsthøjeste bud, og buddet er bindende.
      </p>
    </div>
  );
}
