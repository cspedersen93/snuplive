import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/admin";
import { CARRIERS, isCarrier, trackingText } from "@/lib/carriers";
import { clock, dayLabel, kr } from "@/lib/format";
import { clipUrl, itemImage } from "@/lib/images";
import { historyText, issuePhotos, partyHistory } from "@/lib/issueProof";
import { CARRIER_COVER, ISSUE_REASONS, isIssueReason, RESOLUTION_TEXT } from "@/lib/issues";
import { fetchPickupMarks } from "@/lib/pickup";
import { DELIVERY, sellerPayout } from "@/lib/pricing";
import { fetchCovers, fetchReturns, returnsReady } from "@/lib/returns";
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

/** En afhentning, som køber og sælger ikke begge har bekræftet, og som Relived har fået besked om (0041_afhentning.sql). */
interface PickupRow {
  id: string;
  items_amount: number;
  shipping_amount: number;
  total_amount: number;
  sp_id: string | null;
  paid_at: string | null;
  pickup_buyer_at: string | null;
  pickup_seller_at: string | null;
  buyer_id: string;
  seller_id: string;
  buyer: { handle: string } | null;
  seller: { handle: string } | null;
  show: { title: string } | null;
  sales: { id: string; price: number; item: { name: string } | null }[];
}

const PICKUP_SELECT =
  "id,items_amount,shipping_amount,total_amount,sp_id,paid_at,pickup_buyer_at,pickup_seller_at,buyer_id,seller_id,buyer:profiles!orders_buyer_id_fkey(handle),seller:profiles!orders_seller_id_fkey(handle),show:shows!orders_show_id_fkey(title),sales!sales_order_id_fkey(id,price,item:items(name))";

/** En pakke med Reliveds label, som fragtfirmaet ikke har scannet, og som Relived har fået besked om (0042_rettelser.sql). */
interface ScanRow {
  id: string;
  items_amount: number;
  total_amount: number;
  sp_carrier: string | null;
  sp_name: string | null;
  sp_zipcode: string | null;
  sp_city: string | null;
  tracking: string | null;
  tracking_status: string | null;
  paid_at: string | null;
  label_created_at: string | null;
  buyer_id: string;
  seller_id: string;
  buyer: { handle: string } | null;
  seller: { handle: string } | null;
  show: { title: string } | null;
  sales: { id: string; price: number; item: { name: string } | null }[];
}

const SCAN_SELECT =
  "id,items_amount,total_amount,sp_carrier,sp_name,sp_zipcode,sp_city,tracking,tracking_status,paid_at,label_created_at,buyer_id,seller_id,buyer:profiles!orders_buyer_id_fkey(handle),seller:profiles!orders_seller_id_fkey(handle),show:shows!orders_show_id_fkey(title),sales!sales_order_id_fkey(id,price,item:items(name))";

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
  const openOrderIds = withOrder.map((i) => i.order!.id);
  const [retReady, returns, covers] = await Promise.all([returnsReady(admin), fetchReturns(admin, openOrderIds), fetchCovers(admin, openOrderIds)]);
  // Afhentninger, der ikke er bekræftet af både køber og sælger, og som det daglige job har sendt videre hertil.
  // Uden 0041_afhentning.sql fejler kaldet, og listen er tom.
  const pickupQ = await admin
    .from("orders")
    .select(PICKUP_SELECT)
    .eq("status", "paid")
    .eq("delivery", "pickup")
    .eq("issue_open", false)
    .not("pickup_flagged_at", "is", null)
    .order("paid_at", { ascending: true });
  const pickups = (pickupQ.error ? [] : (pickupQ.data ?? [])) as unknown as PickupRow[];
  // Pakker med Reliveds label, som ikke er scannet flere dage efter, at labelen blev lavet. Uden 0042_rettelser.sql
  // fejler kaldet, og listen er tom.
  const scanQ = await admin
    .from("orders")
    .select(SCAN_SELECT)
    .eq("status", "paid")
    .eq("delivery", "ship")
    .eq("issue_open", false)
    .not("scan_flagged_at", "is", null)
    .order("label_created_at", { ascending: true });
  const unscanned = (scanQ.error ? [] : (scanQ.data ?? [])) as unknown as ScanRow[];
  const [photos, buyers, sellers, marks] = await Promise.all([
    issuePhotos(admin, open.map((i) => i.id)),
    partyHistory(admin, "buyer", [...withOrder.map((i) => i.order!.buyer_id), ...pickups.map((o) => o.buyer_id), ...unscanned.map((o) => o.buyer_id)]),
    partyHistory(admin, "seller", [...withOrder.map((i) => i.order!.seller_id), ...pickups.map((o) => o.seller_id), ...unscanned.map((o) => o.seller_id)]),
    // Sager om en afhentning: hvem har bekræftet?
    fetchPickupMarks(admin, withOrder.filter((i) => i.order!.delivery === "pickup").map((i) => i.order!.id)),
  ]);
  const said = (iso: string | null | undefined) => (iso ? `har bekræftet ${at(iso)}` : "har ikke bekræftet");

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
              {marks?.[o.id] ? (
                <>
                  <b>Afhentning:</b> køberen {said(marks[o.id].buyer)}, sælgeren {said(marks[o.id].seller)}
                  <br />
                </>
              ) : null}
              <b>Beløb:</b> køberen betalte {kr(o.total_amount)}, sælgeren skal have {kr(sellerPayout(o))}
              <br />
              <span className="muted" style={{ fontSize: ".8125rem" }}>Ordre {o.id}</span>
            </div>
            <div className="addr">
              <b>Køberens historik:</b> {historyText(buyers[o.buyer_id], "køb")}
              <br />
              <b>Sælgerens historik:</b> {historyText(sellers[o.seller_id], "salg")}
            </div>
            {(i.reason === "damaged" || i.reason === "not_received") && isCarrier(o.sp_carrier) ? (
              <div className="addr" data-claim>
                <b>Krav mod fragtfirmaet:</b> Labelen er købt af Relived, så det er jer, der rejser kravet hos{" "}
                {CARRIERS[o.sp_carrier].name}
                {o.sp_carrier === "dao" ? " (direkte hos dao)" : " (på GLS' hjemmeside under \"Need Help?\")"}. Fragtfirmaet erstatter op til{" "}
                {kr(CARRIER_COVER[o.sp_carrier] ?? 0)} pr. pakke ifølge Shipmondo. Det er ikke bekræftet, at det også gælder brugte varer. Varerne her kostede {kr(o.items_amount)}.
                {o.tracking ? ` Pakkenummer: ${o.tracking}.` : ""}
                {i.reason === "damaged" ? " Bed køberen gemme varen og al emballagen, til kravet er afgjort." : ""}
              </div>
            ) : null}
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
            {returns[o.id] ? (
              <div className="issue-note" data-return>
                <b>{returns[o.id].sent_at ? "Køberen har sendt varen retur" : "Venter på, at køberen sender varen retur"}</b>
                <span>
                  Bedt om retur {at(returns[o.id].created_at)}.{" "}
                  {returns[o.id].manual
                    ? "Køberen sender selv og skal svare med et sporingsnummer."
                    : `Returlabel med ${returns[o.id].carrier} til ${returns[o.id].sp_name}, ${returns[o.id].sp_zipcode} ${returns[o.id].sp_city}. Returfragten (${kr(returns[o.id].price)}) trækkes fra sælgerens næste udbetaling, når køberen har sendt pakken.`}
                  {returns[o.id].sent_at ? ` Sendt ${at(returns[o.id].sent_at as string)}. Nu kan du refundere køberen.` : ""}
                </span>
              </div>
            ) : null}
            {covers[o.id] && !covers[o.id].refunded_at ? (
              <div className="issue-note">
                <b>Relived dækker er ikke gjort færdig</b>
                <span>Sælgeren har fået sin udbetaling, men refusionen til køberen fejlede. Tryk på knappen for at gøre den færdig.</span>
              </div>
            ) : null}
            <AdminActions
              orderId={o.id}
              refundText={kr(o.total_amount)}
              releaseText={kr(sellerPayout(o))}
              canRelease={o.status === "paid" || o.status === "shipped"}
              canReturn={retReady && !returns[o.id] && (o.status === "paid" || o.status === "shipped")}
              canCover={retReady && (o.status === "paid" || o.status === "shipped")}
              coverText={kr(sellerPayout(o))}
              coverPending={Boolean(covers[o.id] && !covers[o.id].refunded_at)}
            />
          </section>
        );
      })}

      {pickups.length ? (
        <div id="afhentning" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h2 className="h3">Afhentninger, der ikke er bekræftet</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Køber og sælger skal begge bekræfte en afhentning, før pengene går til sælgeren. Her har de ikke gjort det, selv om de har
              fået en påmindelse. Skriv til dem, og afgør ordren.
            </p>
          </div>
          {pickups.map((o) => (
            <section className="box" key={o.id} data-pickup={o.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "baseline" }}>
                <strong>
                  @{o.buyer?.handle ?? "køber"} henter hos @{o.seller?.handle ?? "sælger"}
                </strong>
                <span className="muted" style={{ fontSize: ".875rem" }}>Betalt {at(o.paid_at)}</span>
                <span className="chip warn" style={{ marginLeft: "auto" }}>Afhentning</span>
              </div>
              <div className="addr">
                <b>Køberen:</b> {said(o.pickup_buyer_at)}
                <br />
                <b>Sælgeren:</b> {said(o.pickup_seller_at)}
                <br />
                <b>Varer:</b> {o.sales.map((s) => `${s.item?.name ?? "Vare"} (${kr(s.price)})`).join(", ")} · {o.show?.title}
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
              <AdminActions orderId={o.id} refundText={kr(o.total_amount)} releaseText={kr(sellerPayout(o))} canRelease canClose={false} />
            </section>
          ))}
        </div>
      ) : null}

      {unscanned.length ? (
        <div id="scanning" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h2 className="h3">Pakker, der ikke er scannet</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Labelen er lavet, men fragtfirmaet har ikke scannet pakken. Kun scanningen tæller som sendt, så ordren står stadig som
              betalt. Sælgeren har fået en mail. Tjek sporingen hos fragtfirmaet, og afgør ordren.
            </p>
          </div>
          {unscanned.map((o) => (
            <section className="box" key={o.id} data-scan={o.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "baseline" }}>
                <strong>
                  @{o.buyer?.handle ?? "køber"} venter på en pakke fra @{o.seller?.handle ?? "sælger"}
                </strong>
                <span className="muted" style={{ fontSize: ".875rem" }}>Label lavet {at(o.label_created_at)}</span>
                <span className="chip warn" style={{ marginLeft: "auto" }}>Ikke scannet</span>
              </div>
              <div className="addr">
                <b>Sporing:</b> {trackingText(o.tracking_status) ?? "Ingen sporing endnu."}
                {o.tracking && isCarrier(o.sp_carrier) ? (
                  <>
                    {" "}
                    <a href={CARRIERS[o.sp_carrier].track(o.tracking)} target="_blank" rel="noopener noreferrer">
                      {CARRIERS[o.sp_carrier].name} {o.tracking}
                    </a>
                  </>
                ) : null}
                <br />
                <b>Til:</b> {o.sp_name}
                {o.sp_zipcode ? `, ${o.sp_zipcode} ${o.sp_city ?? ""}` : ""}
                <br />
                <b>Varer:</b> {o.sales.map((s) => `${s.item?.name ?? "Vare"} (${kr(s.price)})`).join(", ")} · {o.show?.title}
                <br />
                <b>Betalt:</b> {at(o.paid_at)} · <b>Beløb:</b> køberen betalte {kr(o.total_amount)}, sælgeren skal have {kr(o.items_amount)}
                <br />
                <span className="muted" style={{ fontSize: ".8125rem" }}>Ordre {o.id}</span>
              </div>
              <div className="addr">
                <b>Køberens historik:</b> {historyText(buyers[o.buyer_id], "køb")}
                <br />
                <b>Sælgerens historik:</b> {historyText(sellers[o.seller_id], "salg")}
              </div>
              <AdminActions orderId={o.id} refundText={kr(o.total_amount)} releaseText="" canRelease={false} canClose={false} canShip />
            </section>
          ))}
        </div>
      ) : null}

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
