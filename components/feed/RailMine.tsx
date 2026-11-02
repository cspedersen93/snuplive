"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useShell } from "@/components/shell/ShellContext";
import { fetchBundles } from "@/lib/bundles";
import { kr, vareOrd, when } from "@/lib/format";
import { itemImage } from "@/lib/images";
import { itemHref } from "@/lib/items";
import { nextBundle } from "@/lib/pricing";
import { getSupabase } from "@/lib/supabase/client";

type Offer = {
  id: string;
  amount: number;
  status: "pending" | "accepted";
  expires_at: string;
  answered_at: string | null;
  item: { id: string; name: string; images: string[] | null } | null;
  seller: { handle: string } | null;
};

type Nudge = { handle: string; more: number; pct: number };

/**
 * Til den, der er logget ind: åbne bud (og bud, sælgeren har sagt ja til) og et skub, når én vare mere fra samme
 * sælger giver samlerabat. Vises kun, når der er noget at vise. Uden bud- eller rabatfilen i databasen er boksene tomme.
 */
export default function RailMine() {
  const { me } = useShell();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);

  useEffect(() => {
    if (!me) {
      setOffers([]);
      setNudges([]);
      return;
    }
    const sb = getSupabase();
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - 3 * 864e5).toISOString();
      const [o, s] = await Promise.all([
        sb
          .from("offers")
          .select(
            "id,amount,status,expires_at,answered_at,item:items!offers_item_id_fkey(id,name,images),seller:profiles!offers_seller_id_fkey(handle)",
          )
          .eq("user_id", me.id)
          .in("status", ["pending", "accepted"])
          .order("created_at", { ascending: false })
          .limit(10),
        sb
          .from("sales")
          .select("seller_id,seller:profiles!sales_seller_id_fkey(handle),order:orders!sales_order_id_fkey(status)")
          .eq("buyer_id", me.id)
          .eq("status", "reserved"),
      ]);
      if (!alive) return;
      const now = Date.now();
      const list = (o.error ? [] : ((o.data ?? []) as unknown as Offer[])).filter((x) =>
        x.status === "pending" ? Date.parse(x.expires_at) > now : (x.answered_at ?? "") > since,
      );
      setOffers(list.slice(0, 3));

      // Samlerabat: hvor mange varer venter der på betaling hos hver sælger?
      type Row = { seller_id: string; seller: { handle: string } | null; order: { status: string } | null };
      const rows = (s.error ? [] : ((s.data ?? []) as unknown as Row[])).filter(
        (r) => !r.order || ["pending", "cancelled"].includes(r.order.status),
      );
      const per = new Map<string, { handle: string; count: number }>();
      for (const r of rows) {
        const g = per.get(r.seller_id) ?? { handle: r.seller?.handle ?? "sælgeren", count: 0 };
        g.count += 1;
        per.set(r.seller_id, g);
      }
      if (!per.size) return setNudges([]);
      const tiers = await fetchBundles(sb, [...per.keys()]);
      if (!alive) return;
      const out: Nudge[] = [];
      for (const [id, g] of per) {
        const n = nextBundle(g.count, tiers.get(id));
        if (n) out.push({ handle: g.handle, more: n.more, pct: n.pct });
      }
      setNudges(out.slice(0, 2));
    })();
    return () => {
      alive = false;
    };
  }, [me]);

  if (!offers.length && !nudges.length) return null;

  return (
    <>
      {nudges.map((n) => (
        <section key={n.handle} className="rail-box rail-bundle" aria-label={`Samlerabat hos ${n.handle}`}>
          <h2 className="rail-h">Spar {n.pct} % hos {n.handle}</h2>
          <p>
            Køb {n.more} {vareOrd(n.more)} mere fra {n.handle}, så får du {n.pct} % samlerabat på det hele, og det kommer i samme
            pakke.
          </p>
          <Link className="rail-link mint" href={`/live/${n.handle}`}>
            Se {n.handle}s varer
          </Link>
        </section>
      ))}
      {offers.length ? (
        <section className="rail-box" aria-labelledby="h-rail-bud">
          <div className="rail-top">
            <h2 className="rail-h" id="h-rail-bud">
              Dine bud
            </h2>
            <Link className="rail-more" href="/kurv#bud">
              Alle
            </Link>
          </div>
          <ul className="rail-list">
            {offers.map((o) => {
              const img = o.item ? itemImage(o.item) : null;
              return (
                <li key={o.id}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" loading="lazy" />
                  ) : (
                    <span className="rail-thumb" aria-hidden="true" />
                  )}
                  <span className="rail-txt">
                    <strong>{o.item ? <Link href={itemHref(o.item)}>{o.item.name}</Link> : "Vare"}</strong>
                    {o.status === "accepted" ? (
                      <span className="ok">
                        {o.seller?.handle ?? "Sælgeren"} sagde ja til {kr(o.amount)}. <Link href="/kurv">Betal her</Link>
                      </span>
                    ) : (
                      <span>
                        Dit bud: {kr(o.amount)} · svar senest {when(o.expires_at).toLowerCase()}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
