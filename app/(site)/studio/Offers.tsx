import Link from "next/link";
import { itemMeta } from "@/components/Screen";
import { gradFor, kr, when } from "@/lib/format";
import { itemImage } from "@/lib/images";
import { itemHref } from "@/lib/items";
import { createClient } from "@/lib/supabase/server";
import OfferAnswer from "./OfferAnswer";

type Row = {
  id: string;
  amount: number;
  price: number;
  created_at: string;
  expires_at: string;
  item: { id: string; name: string; size: string | null; condition: string | null; images: string[] | null; price: number } | null;
  buyer: { handle: string } | null;
};

/** Åbne bud på sælgerens varer til fast pris (0028_bud_paa_varer.sql). Uden filen vises boksen ikke. */
export default async function Offers({ uid }: { uid: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .select(
      "id,amount,price,created_at,expires_at,item:items!offers_item_id_fkey(id,name,size,condition,images,price),buyer:profiles!offers_user_id_fkey(handle)",
    )
    .eq("seller_id", uid)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return null;
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return null;
  return (
    <div className="box offers-box" id="bud">
      <h2 className="h3" style={{ marginBottom: 4 }}>
        Bud på dine varer <span className="count-dot">{rows.length}</span>
      </h2>
      <p className="muted" style={{ fontSize: ".875rem", marginBottom: 6 }}>
        Siger du ja, bliver varen reserveret til køberen til buddet, og køberen betaler inden 3 dage. Svarer du ikke, udløber buddet
        efter 48 timer.
      </p>
      <ul className="list">
        {rows.map((r) => {
          const img = r.item ? itemImage(r.item) : null;
          const pct = r.price ? Math.round((r.amount / r.price) * 100) : 0;
          return (
            <li key={r.id} className="offer-item" style={{ gridTemplateColumns: "44px minmax(0,1fr) auto" }}>
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" />
              ) : (
                <span className="lot-n" style={{ background: gradFor(r.id), width: 44, height: 44 }} aria-hidden="true" />
              )}
              <div style={{ minWidth: 0 }}>
                <strong>
                  {r.item ? <Link href={itemHref(r.item)}>{r.item.name}</Link> : "Vare"}
                </strong>
                <span>
                  <b className="offer-amount">{kr(r.amount)}</b> fra @{r.buyer?.handle ?? "køber"} · din pris {kr(r.price)} ({pct} %)
                </span>
                <span className="fine">
                  {[r.item ? itemMeta(r.item) : "", `Udløber ${when(r.expires_at).toLowerCase()}`].filter(Boolean).join(" · ")}
                </span>
              </div>
              <OfferAnswer id={r.id} amount={r.amount} handle={r.buyer?.handle ?? "køberen"} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
