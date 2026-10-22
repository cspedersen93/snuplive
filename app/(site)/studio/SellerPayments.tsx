import Link from "next/link";
import { IconBox, IconCard, IconInfo } from "@/components/Icons";
import { itemMeta } from "@/components/Screen";
import { CARRIERS, isCarrier, LABEL_WEIGHTS, trackingText } from "@/lib/carriers";
import { ISSUE_REASONS, isIssueReason } from "@/lib/issues";
import { clock, dayLabel, kr } from "@/lib/format";
import { DELIVERED_COMPLETE_DAYS, DELIVERY, RESERVATION_DAYS, sellerPayout } from "@/lib/pricing";
import { hasShipmondo, shipmondoSandbox } from "@/lib/shipmondo";
import { getStripe, stripeTestMode } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CancelReservation, HandedIn, LabelMaker, RefundButton, SenderAddressForm, ShipForm } from "./OrderActions";

type ItemInfo = { name: string; size: string | null; condition: string | null };

interface SellerOrder {
  id: string;
  status: "paid" | "shipped" | "completed" | "refunded";
  delivery: "ship" | "pickup";
  items_amount: number;
  shipping_amount: number;
  total_amount: number;
  ship_name: string | null;
  ship_line1: string | null;
  ship_line2: string | null;
  ship_postal_code: string | null;
  ship_city: string | null;
  buyer_phone: string | null;
  carrier: string | null;
  tracking: string | null;
  transfer_status: "none" | "pending" | "done" | "failed";
  paid_at: string | null;
  sp_carrier: string | null;
  sp_id: string | null;
  sp_name: string | null;
  sp_address: string | null;
  sp_zipcode: string | null;
  sp_city: string | null;
  shipmondo_shipment_id: number | null;
  labelless_code: string | null;
  tracking_status: string | null;
  delivered_at: string | null;
  issue_open: boolean;
  issues: { reason: string; message: string; status: string; created_at: string }[];
  buyer: { handle: string } | null;
  show: { title: string } | null;
  sales: { id: string; price: number; item: ItemInfo | null }[];
}

interface Reservation {
  id: string;
  price: number;
  created_at: string;
  item: ItemInfo | null;
  buyer: { handle: string } | null;
  order: { status: string } | null;
}

const at = (iso: string | null) => (iso ? `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}` : "");

/** Køberen har meldt et problem: vis det til sælgeren. */
function IssueNote({ o }: { o: SellerOrder }) {
  const issue = (o.issues ?? []).find((i) => i.status === "open");
  if (!o.issue_open || !issue) return null;
  return (
    <div className="issue-note" role="status">
      <b>Køberen har meldt et problem {at(issue.created_at)}</b>
      <span>
        {isIssueReason(issue.reason) ? ISSUE_REASONS[issue.reason] : "Problem"}: <q>{issue.message}</q>
      </span>
      <span>Pengene holdes tilbage, mens SnupLive kigger på sagen. Du har fået en mail, du kan svare på.</span>
    </div>
  );
}

const NOTICE: Record<string, [string, string]> = {
  klar: ["ok", "Din udbetaling er klar. Pengene fra dine salg går nu til din bankkonto via Stripe."],
  mangler: ["", "Stripe mangler stadig nogle oplysninger. Tryk “Fortsæt hos Stripe” for at gøre det færdigt."],
  fejl: ["", "Vi kunne ikke åbne Stripe. Prøv igen om lidt."],
  "ikke-sat-op": ["", "Betaling er ikke sat op på SnupLive endnu."],
};

type SenderAddress = { name: string; address1: string; address2: string | null; zipcode: string; city: string; phone: string | null };

export default async function SellerPayments({ uid, search, displayName }: { uid: string; search: string | null; displayName: string }) {
  const supabase = await createClient();
  const ready = Boolean(getStripe() && createAdminClient());
  const labels = ready && hasShipmondo();

  const [acctQ, ordersQ, resQ, addrQ] = await Promise.all([
    supabase.from("payout_accounts").select("payouts_enabled,details_submitted").eq("user_id", uid).maybeSingle(),
    supabase
      .from("orders")
      .select(
        "id,status,delivery,items_amount,shipping_amount,total_amount,ship_name,ship_line1,ship_line2,ship_postal_code,ship_city,buyer_phone,carrier,tracking,transfer_status,paid_at,sp_carrier,sp_id,sp_name,sp_address,sp_zipcode,sp_city,shipmondo_shipment_id,labelless_code,tracking_status,delivered_at,issue_open,issues:order_issues!order_issues_order_id_fkey(reason,message,status,created_at),buyer:profiles!orders_buyer_id_fkey(handle),show:shows!orders_show_id_fkey(title),sales:sales!sales_order_id_fkey(id,price,item:items(name,size,condition))",
      )
      .eq("seller_id", uid)
      .in("status", ["paid", "shipped", "completed", "refunded"])
      .order("paid_at", { ascending: false })
      .limit(60),
    supabase
      .from("sales")
      .select("id,price,created_at,item:items(name,size,condition),buyer:profiles!sales_buyer_id_fkey(handle),order:orders!sales_order_id_fkey(status)")
      .eq("seller_id", uid)
      .eq("status", "reserved")
      .order("created_at", { ascending: true }),
    labels
      ? supabase.from("seller_addresses").select("name,address1,address2,zipcode,city,phone").eq("user_id", uid).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const address = (addrQ.data ?? null) as SenderAddress | null;

  const acct = acctQ.data as { payouts_enabled: boolean; details_submitted: boolean } | null;
  const orders = (ordersQ.data ?? []) as unknown as SellerOrder[];
  const reservations = ((resQ.data ?? []) as unknown as Reservation[]).filter(
    (r) => !r.order || ["pending", "cancelled"].includes(r.order.status),
  );
  const toHandle = orders.filter((o) => o.status === "paid");
  const sent = orders.filter((o) => o.status === "shipped");
  const finished = orders.filter((o) => o.status === "completed" || o.status === "refunded");
  const earned = orders.filter((o) => o.status === "completed").reduce((a, o) => a + sellerPayout(o), 0);
  const needsLabel = toHandle.some((o) => o.sp_id && !o.shipmondo_shipment_id);
  const notice = search ? NOTICE[search] : null;

  return (
    <>
      {notice ? (
        <div className={`notice ${notice[0]}`} role="status">
          <IconInfo />
          <span>{notice[1]}</span>
        </div>
      ) : null}

      {ready ? (
        <div className="box payout">
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <IconCard />
            <div>
              <h2 className="h3">Udbetaling</h2>
              <p className="muted" style={{ fontSize: ".92rem", maxWidth: "52ch" }}>
                {acct?.payouts_enabled
                  ? "Klar. Når køberen har fået sine ting, går pengene for tingene til din bankkonto."
                  : acct?.details_submitted
                    ? "Stripe er ved at tjekke dine oplysninger, eller der mangler noget. Dine penge venter sikkert hos SnupLive imens."
                    : "Tilknyt din bankkonto via Stripe, så du kan få pengene fra dine salg. Det tager et par minutter og kræver MitID eller ID."}
                {stripeTestMode() ? " (Testmiljø: brug Stripes testoplysninger.)" : ""}
              </p>
            </div>
          </div>
          {acct?.payouts_enabled ? (
            <a className="btn btn-line btn-sm" href="/api/stripe/dashboard">Åbn Stripe</a>
          ) : (
            <a className="btn btn-red btn-sm" href="/api/stripe/connect">{acct ? "Fortsæt hos Stripe" : "Tilknyt udbetaling"}</a>
          )}
        </div>
      ) : null}

      <div className="box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
          <h2 className="h3">Skal sendes</h2>
          <span className="muted" style={{ fontSize: ".9rem" }}>{earned ? `${kr(earned)} tjent i alt` : ""}</span>
        </div>
        {toHandle.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {toHandle.map((o) => (
              <div className="seller-order" key={o.id}>
                <div className="so-head">
                  <strong>@{o.buyer?.handle ?? "køber"}</strong>
                  <span className="muted">{o.show?.title} · betalt {at(o.paid_at)}</span>
                  <span className="chip warn">{DELIVERY[o.delivery].short}</span>
                </div>
                <ul className="so-items">
                  {o.sales.map((s) => (
                    <li key={s.id}>
                      <span>{s.item?.name}{s.item && itemMeta(s.item) ? ` · ${itemMeta(s.item)}` : ""}</span>
                      <span className="num">{kr(s.price)}</span>
                    </li>
                  ))}
                </ul>
                {o.delivery === "ship" && o.sp_id ? (
                  <>
                    <p className="addr">
                      <b>Til {isCarrier(o.sp_carrier) ? `${CARRIERS[o.sp_carrier].name}-pakkeshop` : "pakkeshop"}:</b> {o.sp_name}
                      {o.sp_address ? `, ${o.sp_address}` : ""}, {o.sp_zipcode} {o.sp_city}
                      <br />
                      <b>Modtager:</b> {o.ship_name ?? `@${o.buyer?.handle}`}
                    </p>
                    {o.shipmondo_shipment_id ? (
                      <div className="label-box">
                        <div className="row">
                          <a className="btn btn-red btn-sm" href={`/api/orders/${o.id}/label?format=a4`} target="_blank" rel="noopener">
                            Hent label (A4)
                          </a>
                          <a className="btn btn-line btn-sm" href={`/api/orders/${o.id}/label?format=10x19`} target="_blank" rel="noopener">
                            Labelprinter 10×19
                          </a>
                        </div>
                        {o.labelless_code ? (
                          <p className="fine">
                            Ingen printer? Skriv koden <span className="code-big">{o.labelless_code}</span> tydeligt på pakken.
                          </p>
                        ) : null}
                        <p className="fine">
                          Pak tingene godt ind, sæt labelen på, og aflever pakken i en {isCarrier(o.sp_carrier) ? CARRIERS[o.sp_carrier].name : ""}-pakkeshop.
                          Ordren skifter selv til &quot;Sendt&quot;, når pakken bliver scannet.
                          {o.tracking ? ` Sporingsnummer ${o.tracking}.` : ""}
                        </p>
                        <div className="row">
                          <HandedIn orderId={o.id} />
                        </div>
                      </div>
                    ) : labels ? (
                      <LabelMaker orderId={o.id} weights={LABEL_WEIGHTS} hasAddress={Boolean(address)} />
                    ) : (
                      <p className="fine">Fragtlabels er ikke slået til lige nu. Prøv igen senere.</p>
                    )}
                    <p className="fine">Køberen har betalt fragten. Du får {kr(sellerPayout(o))} for tingene, når køberen har fået pakken.</p>
                  </>
                ) : o.delivery === "ship" ? (
                  <>
                    <address className="addr">
                      <b>Send til:</b> {o.ship_name}
                      <br />
                      {o.ship_line1}
                      {o.ship_line2 ? `, ${o.ship_line2}` : ""}
                      <br />
                      {o.ship_postal_code} {o.ship_city}
                      {o.buyer_phone ? (
                        <>
                          <br />
                          Tlf. {o.buyer_phone}
                        </>
                      ) : null}
                    </address>
                    <p className="fine">Send til nærmeste pakkeshop ved adressen (fx med GLS, PostNord eller DAO). Køberen har betalt {kr(o.shipping_amount)} i fragt, som du får sammen med tingene.</p>
                    <ShipForm orderId={o.id} />
                  </>
                ) : (
                  <p className="addr">
                    <b>Afhentning:</b> kontakt {o.ship_name ?? `@${o.buyer?.handle}`}
                    {o.buyer_phone ? ` på ${o.buyer_phone}` : ""} og aftal tid og sted. Køberen bekræfter i appen, når tingene er hentet.
                  </p>
                )}
                <IssueNote o={o} />
                <RefundButton orderId={o.id} amount={kr(o.total_amount)} />
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: ".95rem" }}>Når nogen har betalt for dine ting, står pakkerne her med adressen.</p>
        )}
      </div>

      {labels ? (
        <div className="box" id="afsender">
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12 }}>
            <IconBox />
            <div>
              <h2 className="h3">Fragt og afsenderadresse</h2>
              <p className="muted" style={{ fontSize: ".92rem", maxWidth: "56ch" }}>
                Køberen vælger en DAO- eller GLS-pakkeshop og betaler fragten. Du laver labelen her med ét tryk. Din adresse står
                som afsender, og pakken kommer retur hertil, hvis den ikke bliver hentet.
                {shipmondoSandbox() ? " (Testmiljø: labels er mærket SANDBOX og kan ikke bruges.)" : ""}
              </p>
            </div>
          </div>
          {needsLabel && !address ? (
            <div className="notice" role="status">
              <IconInfo />
              <span>Du har pakker, der venter på en label. Udfyld din adresse først.</span>
            </div>
          ) : null}
          <SenderAddressForm uid={uid} initial={address} fallbackName={displayName} />
        </div>
      ) : null}

      {sent.length || finished.length ? (
        <div className="box">
          <h2 className="h3" style={{ marginBottom: 6 }}>Sendt og afsluttet</h2>
          <ul className="list">
            {[...sent, ...finished].map((o) => (
              <li key={o.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div>
                  <strong>@{o.buyer?.handle ?? "køber"} · {o.sales.length} {o.sales.length === 1 ? "ting" : "ting"}</strong>
                  <span>
                    {o.status === "shipped"
                      ? o.sp_id && trackingText(o.tracking_status)
                        ? `${trackingText(o.tracking_status)}${o.delivered_at ? ` Ordren afsluttes senest ${DELIVERED_COMPLETE_DAYS} dage efter.` : ""}`
                        : `Sendt${o.tracking ? ` · ${o.carrier ?? ""} ${o.tracking}` : ""}. Venter på, at køberen bekræfter.`
                      : o.status === "refunded"
                        ? "Refunderet til køberen."
                        : o.transfer_status === "done"
                          ? "Modtaget. Pengene er sendt til din Stripe-konto."
                          : o.transfer_status === "pending"
                            ? "Modtaget. Pengene venter, til du har tilknyttet udbetaling."
                            : "Modtaget. Udbetalingen bliver forsøgt igen i nat."}
                  </span>
                  <IssueNote o={o} />
                </div>
                <span className="num" style={{ fontWeight: 600 }}>{kr(sellerPayout(o))}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {reservations.length ? (
        <div className="box">
          <h2 className="h3" style={{ marginBottom: 4 }}>Snuppet, men ikke betalt endnu</h2>
          <p className="muted" style={{ fontSize: ".9rem", marginBottom: 6 }}>
            Køberen har {RESERVATION_DAYS} dage til at betale. Derefter bliver snuppet annulleret af sig selv.
          </p>
          <ul className="list">
            {reservations.map((r) => (
              <li key={r.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 14 }}>
                <div>
                  <strong>{r.item?.name}</strong>
                  <span>@{r.buyer?.handle ?? "køber"} · snuppet {at(r.created_at)}</span>
                </div>
                <span className="num">{kr(r.price)}</span>
                <CancelReservation saleId={r.id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!ready ? (
        <p className="fine">
          Betaling er ikke slået til endnu. <Link href="/kurv">Mine snup</Link> viser køberne, at betaling kommer snart.
        </p>
      ) : null}
    </>
  );
}
