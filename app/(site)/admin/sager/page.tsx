import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/admin";
import { CARRIERS, isCarrier, trackingText } from "@/lib/carriers";
import { clock, dayLabel, kr } from "@/lib/format";
import { clipUrl, itemImage } from "@/lib/images";
import { historyText, issuePhotos, partyHistory } from "@/lib/issueProof";
import { ISSUE_REASONS, isIssueReason, RESOLUTION_TEXT } from "@/lib/issues";
import { DELIVERY, sellerPayout } from "@/lib/pricing";
import AdminActions from "../AdminActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sager" };

interface IssueRow {
  id: string;
  reason: string;
  message: string;
  status: "open" | "resolved";
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  order: {
    id: string;
    status: string;
    delivery: "ship" | "pickup";
    items_amount: number;
    shipping_amount: number;
    total_amount: number;
    sp_id: string | null;
    sp_name: string | null;
    sp_carrier: string | null;
    carrier: string | null;
    tracking: string | null;
    tracking_status: string | null;
    paid_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    buyer_id: string;
    seller_id: string;
    buyer: { handle: string } | null;
    seller: { handle: string } | null;
    show: { title: string } | null;
    sales: { id: string; price: number; item: { name: string; images: string[] | null; clip_path: string | null; clip_at: string | null } | null }[];
  } | null;
}

const STATUS_TEXT: Record<string, string> = { paid: "Betalt", shipped: "Sendt", completed: "Afsluttet", refunded: "Refunderet" };

const at = (iso: string | null) => (iso ? `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}` : "–");

const SELECT =
  "id,reason,message,status,resolution,created_at,resolved_at,order:orders!order_issues_order_id_fkey(id,buyer_id,seller_id,status,delivery,items_amount,shipping_amount,total_amount,sp_id,sp_name,sp_carrier,carrier,tracking,tracking_status,paid_at,shipped_at,delivered_at,buyer:profiles!orders_buyer_id_fkey(handle),seller:profiles!orders_seller_id_fkey(handle),show:shows!orders_show_id_fkey(title),sales:sales!sales_order_id_fkey(id,price,item:items(name,images,clip_path,clip_at)))";

/** Sager, hvor en køber har meldt et problem. Kun for e-mails i ADMIN_EMAILS. */
export default async function Admin() {
  const { admin } = await requireAdmin("/admin/sager");
  if (!admin) return <SetupNotice />;

  const [openQ, doneQ] = await Promise.all([
    admin.from("order_issues").select(SELECT).eq("status", "open").order("created_at", { ascending: true }),
    admin.from("order_issues").select(SELECT).eq("status", "resolved").order("resolved_at", { ascending: false }).limit(20),
  ]);
  const open = (openQ.data ?? []) as unknown as IssueRow[];
  const done = (doneQ.data ?? []) as unknown as IssueRow[];
  const withOrder = open.filter((i) => i.order);
  const [photos, buyers, sellers] = await Promise.all([
    issuePhotos(admin, open.map((i) => i.id)),
    partyHistory(admin, "buyer", withOrder.map((i) => i.order!.buyer_id)),
    partyHistory(admin, "seller", withOrder.map((i) => i.order!.seller_id)),
  ]);

  return (
    <div className="adm-page" style={{ maxWidth: 900 }}>
      <div>
        <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", letterSpacing: "-.035em", lineHeight: 1.05, marginTop: 6 }}>Sager</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {open.length ? `${open.length} ${open.length === 1 ? "åben sag" : "åbne sager"}. Pengene holdes tilbage, indtil du afgør dem.` : "Ingen åbne sager lige nu."}
        </p>
      </div>

      {open.map((i) => {
        const o = i.order;
        if (!o) return null;
        return (
          <section className="box" key={i.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "baseline" }}>
              <strong>{isIssueReason(i.reason) ? ISSUE_REASONS[i.reason] : i.reason}</strong>
              <span className="muted" style={{ fontSize: ".875rem" }}>Meldt {at(i.created_at)}</span>
              <span className="chip warn" style={{ marginLeft: "auto" }}>{STATUS_TEXT[o.status] ?? o.status}</span>
            </div>
            <div className="issue-note">
              <span>
                @{o.buyer?.handle ?? "køber"} skriver: <q>{i.message}</q>
              </span>
            </div>
            <div className="addr">
              <b>Sælger:</b> @{o.seller?.handle} · {o.show?.title}
              <br />
              <b>Varer:</b> {o.sales.map((s) => `${s.item?.name ?? "Vare"} (${kr(s.price)})`).join(", ")}
              <br />
              <b>Levering:</b> {DELIVERY[o.delivery].label}
              {o.sp_name ? ` · ${isCarrier(o.sp_carrier) ? CARRIERS[o.sp_carrier].name : ""} ${o.sp_name}` : ""}
              {o.tracking ? (
                <>
                  {" · "}
                  {isCarrier(o.sp_carrier) ? (
                    <a href={CARRIERS[o.sp_carrier].track(o.tracking)} target="_blank" rel="noopener noreferrer">{o.tracking}</a>
                  ) : (
                    `${o.carrier ?? ""} ${o.tracking}`
                  )}
                </>
              ) : null}
              {trackingText(o.tracking_status) ? ` · ${trackingText(o.tracking_status)}` : ""}
              <br />
              <b>Betalt:</b> {at(o.paid_at)} · <b>Sendt:</b> {at(o.shipped_at)} · <b>Hentet:</b> {at(o.delivered_at)}
              <br />
              <b>Beløb:</b> køberen betalte {kr(o.total_amount)}, sælgeren skal have {kr(sellerPayout(o))}
              <br />
              <span className="muted" style={{ fontSize: ".8125rem" }}>Ordre {o.id}</span>
            </div>
            <div className="addr">
              <b>Køberens historik:</b> {historyText(buyers[o.buyer_id], "køb")}
              <br />
              <b>Sælgerens historik:</b> {historyText(sellers[o.seller_id], "salg")}
            </div>
            <div className="proof">
              <h3>Det, sælgeren viste</h3>
              <div className="proof-grid">
                {o.sales.map((s) => {
                  const clip = s.item ? clipUrl(s.item) : null;
                  const img = s.item ? itemImage(s.item) : null;
                  return (
                    <figure key={s.id}>
                      {clip ? (
                        <video src={clip} controls playsInline preload="metadata" />
                      ) : img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={`Sælgerens billede af ${s.item?.name ?? "varen"}`} />
                      ) : null}
                      <figcaption>
                        {s.item?.name ?? "Vare"}: {clip ? "video fra showet" : img ? "sælgerens billede (ingen video)" : "hverken video eller billede"}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
              <h3>Det, køberen har fået</h3>
              {photos[i.id]?.length ? (
                <div className="proof-grid">
                  {photos[i.id].map((url, n) => (
                    <figure key={url}>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Køberens billede ${n + 1}`} />
                      </a>
                      <figcaption>Køberens billede {n + 1}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: ".875rem", margin: 0 }}>Køberen har ikke vedhæftet billeder.</p>
              )}
            </div>
            <AdminActions
              orderId={o.id}
              refundText={kr(o.total_amount)}
              releaseText={kr(sellerPayout(o))}
              canRelease={o.status === "paid" || o.status === "shipped"}
            />
          </section>
        );
      })}

      {done.length ? (
        <div className="box">
          <h2 className="h3" style={{ marginBottom: 6 }}>Afgjorte sager</h2>
          <ul className="list">
            {done.map((i) => (
              <li key={i.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div>
                  <strong>
                    @{i.order?.buyer?.handle} ← @{i.order?.seller?.handle} · {isIssueReason(i.reason) ? ISSUE_REASONS[i.reason] : i.reason}
                  </strong>
                  <span>{i.resolution ? RESOLUTION_TEXT[i.resolution] : ""} Afgjort {at(i.resolved_at)}.</span>
                </div>
                <span className="num">{i.order ? kr(i.order.total_amount) : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
