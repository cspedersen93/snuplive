import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/AccountNav";
import Avatar from "@/components/Avatar";
import { IconInfo, IconShield } from "@/components/Icons";
import { itemMeta } from "@/components/Screen";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { clock, dayLabel, kr } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mine snup", robots: { index: false } };

interface Row {
  id: string;
  price: number;
  status: string;
  created_at: string;
  item: { name: string; size: string | null; condition: string | null } | null;
  show: { id: string; title: string; seller: { handle: string; display_name: string | null } | null } | null;
}

const STATUS: Record<string, string> = {
  reserved: "Reserveret",
  paid: "Betalt",
  shipped: "Sendt",
  done: "Modtaget",
  cancelled: "Annulleret",
};

export default async function Kurv() {
  const ctx = await requireProfile("/kurv");
  if (!ctx) return <SetupNotice />;
  const { supabase, uid, profile } = ctx;

  const { data } = await supabase
    .from("sales")
    .select(
      "id,price,status,created_at,item:items(name,size,condition),show:shows(id,title,seller:profiles!shows_seller_id_fkey(handle,display_name))",
    )
    .eq("buyer_id", uid)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Row[];
  const open = rows.filter((r) => r.status === "reserved");

  // Gruppér efter show: alt fra samme sælger i samme show sendes i én pakke.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.show?.id ?? "ukendt";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const total = open.reduce((a, r) => a + r.price, 0);

  return (
    <div className="wrap dash">
      <AccountNav profile={profile} active="kurv" snupCount={open.length} />
      <div className="dpanel">
        <div className="dpanel-head">
          <div>
            <span className="label">Kurv</span>
            <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", letterSpacing: "-.035em", lineHeight: 1.05, marginTop: 6 }}>Mine snup</h1>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <p style={{ marginBottom: 14 }}>Du har ikke snuppet noget endnu.</p>
            <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
          </div>
        ) : (
          <div className="cart-grid" style={{ paddingBlock: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div className="notice">
                <IconInfo />
                <span>
                  SnupLive er i beta, så der bliver ikke trukket penge endnu. Et snup er en bindende reservation hos
                  sælgeren. Betaling med MobilePay og kort samt fragtlabels kommer inden lanceringen.
                </span>
              </div>
              {[...groups.entries()].map(([key, list]) => {
                const seller = list[0].show?.seller;
                const sub = list.filter((r) => r.status === "reserved").reduce((a, r) => a + r.price, 0);
                return (
                  <section className="group" key={key} aria-label={list[0].show?.title ?? "Show"}>
                    <div className="group-head">
                      <div className="seller-row">
                        <Avatar handle={seller?.handle ?? "s"} />
                        <div>
                          <strong>{seller?.handle ?? "Ukendt sælger"}</strong>
                          <span className="muted" style={{ fontSize: ".85rem" }}>{list[0].show?.title}</span>
                        </div>
                      </div>
                      {seller ? <Link className="linkbtn" href={`/live/${seller.handle}`}>Til sælgeren</Link> : null}
                    </div>
                    {list.map((r) => (
                      <div className="citem" key={r.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                        <div style={{ minWidth: 0 }}>
                          <strong>{r.item?.name ?? "Ting"}</strong>
                          <span className="from">
                            {[r.item ? itemMeta(r.item) : "", `Snuppet ${dayLabel(r.created_at).toLowerCase()} kl. ${clock(r.created_at)}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <div className="right">
                          <span className="num" style={{ fontWeight: 600 }}>{kr(r.price)}</span>
                          <span className={`chip${r.status === "reserved" ? " warn" : r.status === "cancelled" ? " sold" : " ok"}`}>{STATUS[r.status] ?? r.status}</span>
                        </div>
                      </div>
                    ))}
                    <div className="group-foot">
                      <span>Sendes i én pakke</span>
                      <b>{sub ? kr(sub) : "Afsluttet"}</b>
                    </div>
                  </section>
                );
              })}
            </div>
            <aside className="summary" aria-label="Oversigt">
              <h2 className="h3">Oversigt</h2>
              <div className="sum-row"><span>Reserverede ting</span><span className="num">{open.length}</span></div>
              <div className="sum-row"><span>Fragt</span><span className="num">Ved betaling</span></div>
              <div className="sum-row total"><span>I alt</span><span className="num">{kr(total)}</span></div>
              <button className="btn btn-red btn-block" type="button" disabled>Betaling åbner snart</button>
              <div className="protect">
                <IconShield />
                <span>Ved lanceringen holder vi pengene tilbage, til du har fået dine ting.</span>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
