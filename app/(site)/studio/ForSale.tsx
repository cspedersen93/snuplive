import { itemMeta } from "@/components/Screen";
import { gradFor } from "@/lib/format";
import { itemImage } from "@/lib/images";
import { itemHref } from "@/lib/items";
import { createClient } from "@/lib/supabase/server";
import { ITEM_COLS, type Item } from "@/lib/types";
import { ClipRow, ForSaleRow } from "./OrderActions";

/** Sælgerens usolgte ting fra afsluttede shows: til salg til fast pris, eller taget af. */
export default async function ForSale({ uid }: { uid: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(`${ITEM_COLS},show:shows!items_show_id_fkey(status,title)`)
    .eq("seller_id", uid)
    .eq("status", "unsold")
    .order("listed_at", { ascending: false })
    .limit(200);
  // Klip hentes for sig, så listen virker, også før 0015_klip.sql er kørt.
  const { data: clipData, error: clipErr } = await supabase
    .from("items")
    .select("id")
    .eq("seller_id", uid)
    .eq("status", "unsold")
    .not("clip_path", "is", null)
    .limit(200);
  const withClip = new Set(clipErr ? [] : (clipData ?? []).map((c: { id: string }) => c.id));
  const rows = ((data ?? []) as unknown as (Item & { show: { status: string; title: string } | null })[]).filter(
    (r) => r.show?.status === "ended",
  );
  if (!rows.length) return null;
  const live = rows.filter((r) => r.for_sale).length;
  return (
    <div className="box">
      <h2 className="h3" style={{ marginBottom: 4 }}>Til salg</h2>
      <p className="muted" style={{ fontSize: ".9rem", marginBottom: 6 }}>
        {live} {live === 1 ? "ting" : "ting"} fra dine shows kan købes til fast pris. Ret prisen, eller tag en ting af, hvis du vil
        vise den i dit næste show.
      </p>
      <ul className="list">
        {rows.map((r) => (
          <li key={r.id} style={{ gridTemplateColumns: "44px minmax(0,1fr) auto" }}>
            {itemImage(r) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={itemImage(r) as string} alt="" />
            ) : (
              <span className="lot-n" style={{ background: gradFor(r.id), width: 44, height: 44 }} aria-hidden="true" />
            )}
            <div style={{ minWidth: 0 }}>
              <strong>
                <a href={itemHref(r)}>{r.name}</a>
              </strong>
              <span>{[itemMeta(r), r.show?.title].filter(Boolean).join(" · ")}</span>
              {withClip.has(r.id) ? <ClipRow id={r.id} href={itemHref(r)} /> : null}
            </div>
            <ForSaleRow id={r.id} price={r.price} forSale={r.for_sale} />
          </li>
        ))}
      </ul>
    </div>
  );
}
