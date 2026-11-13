import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/AccountNav";
import Avatar from "@/components/Avatar";
import { IconInfo } from "@/components/Icons";
import { itemMeta } from "@/components/Screen";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { CARRIERS, isCarrier, trackingText } from "@/lib/carriers";
import { BUYER_RESOLUTION_TEXT, ISSUE_REASONS, isIssueReason } from "@/lib/issues";
import { clock, dayLabel, kr } from "@/lib/format";
import { fetchBundles } from "@/lib/bundles";
import { itemHref } from "@/lib/items";
import { markCheckoutPaid } from "@/lib/orders";
import { fetchPackageSizes, fetchPickupOnly } from "@/lib/parcels";
import { AUTO_COMPLETE_DAYS, DELIVERED_COMPLETE_DAYS, DELIVERY, itemParcel, parcelFor, PICKUP_CATEGORIES, RESERVATION_DAYS, type Parcel } from "@/lib/pricing";
import { feeFreeDay, feeFreeState } from "@/lib/feeFree";
import { hasShipmondo } from "@/lib/shipmondo";
import { getStripe, stripeTestMode } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import ConfirmReceived from "./ConfirmReceived";
import PayGroups, { type PayGroup } from "./PayGroups";
import RateSeller from "./RateSeller";
import ReportProblem from "./ReportProblem";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mine køb", robots: { index: false } };

type Seller = { handle: string; display_name: string | null; avatar_path: string | null; seller_type?: string | null };
type ItemInfo = { name: string; size: string | null; condition: string | null; category?: string | null };

interface SaleRow {
  id: string;
  item_id: string;
  price: number;
  created_at: string;
  seller_id: string;
  show_id: string;
  item: ItemInfo | null;
  show: { title: string; category?: string | null } | null;
  seller: Seller | null;
  order: { status: string } | null;
}

interface OrderRow {
  id: string;
  status: "paid" | "shipped" | "completed" | "refunded";
  delivery: "ship" | "pickup";
  items_amount: number;
  shipping_amount: number;
  fee_amount: number;
  total_amount: number;
  carrier: string | null;
  tracking: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  sp_carrier: string | null;
  sp_name: string | null;
  sp_address: string | null;
  sp_zipcode: string | null;
  sp_city: string | null;
  tracking_status: string | null;
  delivered_at: string | null;
  issue_open: boolean;
  issues: { reason: string; message: string; status: string; resolution: string | null; created_at: string }[];
  seller: Seller | null;
  show: { title: string } | null;
  sales: { id: string; price: number; item: ItemInfo | null }[];
  /** Én bedømmelse pr. ordre. PostgREST giver et objekt (én-til-én), men vi tager også imod en liste. */
  ratings: { stars: number } | { stars: number }[] | null;
}

const STATUS: Record<OrderRow["status"], [string, string]> = {
  paid: ["warn", "Betalt"],
  shipped: ["live", "Sendt"],
  completed: ["ok", "Modtaget"],
  refunded: ["sold", "Refunderet"],
};

function deadline(iso: string) {
  const d = new Date(Date.parse(iso) + RESERVATION_DAYS * 864e5).toISOString();
  return `${dayLabel(d).toLowerCase()} kl. ${clock(d)}`;
}

function when(iso: string | null) {
  return iso ? `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}` : "";
}

export default async function Kurv({ searchParams }: { searchParams: Promise<{ betaling?: string }> }) {
  const ctx = await requireProfile("/kurv");
  if (!ctx) return <SetupNotice />;
  const { supabase, uid, profile } = ctx;
  const { betaling } = await searchParams;

  const stripe = getStripe();
  const admin = createAdminClient();
  const ready = Boolean(stripe && admin);

  // Kommer køberen tilbage fra Stripe, tjekker vi betalingen med det samme (webhooken kan være lidt bagud).
  let banner: "ok" | "afbrudt" | "venter" | null = null;
  if (betaling === "annulleret") banner = "afbrudt";
  else if (betaling?.startsWith("cs_") && stripe && admin) {
    try {
      const session = await stripe.checkout.sessions.retrieve(betaling);
      if (session.metadata?.buyer_id === uid) {
        banner = session.payment_status === "paid" ? "ok" : "venter";
        if (session.payment_status === "paid") await markCheckoutPaid(admin, stripe, session);
      }
    } catch {
      banner = "venter";
    }
  }

  const [salesQ, ordersQ] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id,item_id,price,created_at,seller_id,show_id,item:items(name,size,condition,category),show:shows(title,category),seller:profiles!sales_seller_id_fkey(handle,display_name,avatar_path),order:orders!sales_order_id_fkey(status)",
      )
      .eq("buyer_id", uid)
      .eq("status", "reserved")
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select(
        "id,status,delivery,items_amount,shipping_amount,fee_amount,total_amount,carrier,tracking,paid_at,shipped_at,completed_at,sp_carrier,sp_name,sp_address,sp_zipcode,sp_city,tracking_status,delivered_at,issue_open,issues:order_issues!order_issues_order_id_fkey(reason,message,status,resolution,created_at),seller:profiles!orders_seller_id_fkey(handle,display_name,avatar_path,seller_type),show:shows!orders_show_id_fkey(title),sales:sales!sales_order_id_fkey(id,price,item:items(name,size,condition)),ratings:ratings!ratings_order_id_fkey(stars)",
      )
      .eq("buyer_id", uid)
      .in("status", ["paid", "shipped", "completed", "refunded"])
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);

  // Billeder på en sag (0038_klage_bevis.sql). Uden filen vises feltet ikke.
  const photosReady = !(await supabase.from("order_issues").select("photos").limit(1)).error;

  // Køberens åbne bud på varer til fast pris (0028_bud_paa_varer.sql). Uden filen er listen tom.
  const offersQ = await supabase
    .from("offers")
    .select("id,amount,price,expires_at,item:items!offers_item_id_fkey(id,name),seller:profiles!offers_seller_id_fkey(handle)")
    .eq("user_id", uid)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  const myOffers = (offersQ.error ? [] : (offersQ.data ?? [])) as unknown as {
    id: string;
    amount: number;
    price: number;
    expires_at: string;
    item: { id: string; name: string } | null;
    seller: { handle: string } | null;
  }[];

  const toPay = ((salesQ.data ?? []) as unknown as SaleRow[]).filter(
    (s) => !s.order || ["pending", "cancelled"].includes(s.order.status),
  );
  const orders = (ordersQ.data ?? []) as unknown as OrderRow[];

  // Én pakke pr. sælger: alt, du har købt hos samme sælger, betales og sendes samlet, også fra flere shows.
  const groupsMap = new Map<string, PayGroup>();
  const showsOf = new Map<string, Set<string>>();
  // Pakkestørrelsen pr. vare (0030_pakkestoerrelse.sql), ellers kategoriens standard. Fragten følger hele pakken.
  const sizes = await fetchPackageSizes(supabase, toPay.map((s) => s.item_id));
  // Varer, sælgeren har sat til kun afhentning (0036_kun_afhentning.sql). Betalingen tvinger det også på serveren.
  const pickupOnly = await fetchPickupOnly(supabase, toPay.map((s) => s.item_id));
  // Gratis-kampagnen: 0 kr i køberbeskyttelse (lib/feeFree.ts).
  const free = await feeFreeState();
  const parcelsOf = new Map<string, Parcel[]>();
  for (const s of toPay) {
    const key = s.seller_id;
    const g =
      groupsMap.get(key) ??
      ({
        key,
        seller: s.seller ?? { handle: "sælger", display_name: null, avatar_path: null },
        showTitle: s.show?.title ?? "",
        deadline: deadline(s.created_at),
        items: [],
        parcel: "small",
      } satisfies PayGroup);
    g.items.push({ id: s.id, name: s.item?.name ?? "Vare", meta: s.item ? itemMeta(s.item) : "", price: s.price });
    // Cykler og barnevogne kan ikke sendes til en pakkeshop, så afhentning er valgt på forhånd.
    if (PICKUP_CATEGORIES.includes((s.item?.category ?? s.show?.category ?? "") as string)) g.pickup = true;
    if (pickupOnly.has(s.item_id)) g.pickupOnly = true;
    groupsMap.set(key, g);
    showsOf.set(key, (showsOf.get(key) ?? new Set()).add(s.show_id));
    parcelsOf.set(key, [...(parcelsOf.get(key) ?? []), itemParcel({ package_size: sizes.get(s.item_id), category: s.item?.category }, s.show?.category)]);
  }
  for (const [key, g] of groupsMap) g.parcel = parcelFor(parcelsOf.get(key) ?? []);
  for (const [key, g] of groupsMap) if ((showsOf.get(key)?.size ?? 0) > 1) g.showTitle = "Fra flere shows";
  // Sælgernes samlerabat (0027_samlerabat.sql). Betalingen regner den ud igen på serveren.
  const bundles = await fetchBundles(supabase, [...groupsMap.keys()]);
  for (const [key, g] of groupsMap) g.bundle = bundles.get(key) ?? null;
  const groups = [...groupsMap.values()];
  const active = orders.filter((o) => o.status === "paid" || o.status === "shipped");
  const done = orders.filter((o) => o.status === "completed" || o.status === "refunded");

  return (
    <div className="wrap dash">
      <AccountNav profile={profile} active="kurv" snupCount={toPay.length} />
      <div className="dpanel">
        <div className="dpanel-head">
          <div>
            <span className="label">Kurv</span>
            <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", letterSpacing: "-.035em", lineHeight: 1.05, marginTop: 6 }}>Mine køb</h1>
          </div>
        </div>

        {banner === "ok" ? (
          <div className="notice ok" role="status">
            <IconInfo />
            <span><b>Tak for din betaling!</b> Sælgeren får besked og pakker dine varer. Du kan følge ordren herunder.</span>
          </div>
        ) : banner === "venter" ? (
          <div className="notice" role="status">
            <IconInfo />
            <span>Vi venter på bekræftelse fra Stripe. Opdatér siden om lidt.</span>
          </div>
        ) : banner === "afbrudt" ? (
          <div className="notice" role="status">
            <IconInfo />
            <span>Betalingen blev afbrudt. Dine køb er stadig reserveret, så du kan prøve igen.</span>
          </div>
        ) : null}

        {groups.length ? (
          <>
            <div className="sec-mini">
              <h2 className="h3">Til betaling</h2>
              <p className="muted" style={{ fontSize: ".9375rem" }}>
                Betal inden {RESERVATION_DAYS} dage, ellers bliver købet annulleret, og sælgeren kan sælge varen igen.
              </p>
            </div>
            {ready && stripeTestMode() ? (
              <div className="notice" role="note">
                <IconInfo />
                <span>
                  <b>Testbetaling:</b> der bliver ikke trukket rigtige penge. Brug kortnummer 4242 4242 4242 4242, en
                  udløbsdato i fremtiden og en vilkårlig kode.
                </span>
              </div>
            ) : null}
            <PayGroups groups={groups} ready={ready} pakkeshop={hasShipmondo()} feeFreeUntil={free.active && free.until ? feeFreeDay(free.until) : null} />
          </>
        ) : null}

        {myOffers.length ? (
          <div className="sec-mini" id="bud">
            <h2 className="h3">Dine bud</h2>
            <p className="muted" style={{ fontSize: ".9375rem" }}>
              Sælgeren har 48 timer til at svare. Siger sælgeren ja, kommer varen her under Til betaling.
            </p>
            <ul className="list offer-list">
              {myOffers.map((o) => (
                <li key={o.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{o.item ? <Link href={itemHref(o.item)}>{o.item.name}</Link> : "Vare"}</strong>
                    <span>
                      Hos @{o.seller?.handle ?? "sælger"} · prisen er {kr(o.price)} · gælder til {when(o.expires_at)}
                    </span>
                  </div>
                  <span className="num offer-amount">{kr(o.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {active.length ? (
          <div className="sec-mini">
            <h2 className="h3">På vej til dig</h2>
            {active.map((o) => (
              <OrderCard key={o.id} o={o} uid={uid} photosReady={photosReady} />
            ))}
          </div>
        ) : null}

        {done.length ? (
          <div className="sec-mini">
            <h2 className="h3">Tidligere køb</h2>
            {done.map((o) => (
              <OrderCard key={o.id} o={o} uid={uid} photosReady={photosReady} />
            ))}
          </div>
        ) : null}

        {!groups.length && !orders.length && !myOffers.length ? (
          <div className="empty">
            <p style={{ marginBottom: 14 }}>Du har ikke købt noget endnu.</p>
            <Link className="btn btn-ivory" href="/live">Se hvem der er live</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OrderCard({ o, uid, photosReady }: { o: OrderRow; uid: string; photosReady: boolean }) {
  const [cls, label] = STATUS[o.status];
  const issue = [...(o.issues ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const seller = o.seller;
  const rated = Array.isArray(o.ratings) ? o.ratings[0] : o.ratings;
  // Samlerabat: forskellen mellem varernes priser og det, der blev betalt for varerne.
  const discount = Math.max(0, o.sales.reduce((a, s) => a + s.price, 0) - o.items_amount);
  return (
    <section className="group" aria-label={`Ordre fra ${seller?.handle ?? "sælger"}`}>
      <div className="group-head">
        <div className="seller-row">
          <Avatar handle={seller?.handle ?? "s"} path={seller?.avatar_path} />
          <div>
            <strong>{seller?.handle ?? "Sælger"}</strong>
            <span className="muted" style={{ fontSize: ".875rem" }}>{o.show?.title}</span>
          </div>
        </div>
        <span className={`chip ${cls}`}>{label}</span>
      </div>
      {o.sales.map((s) => (
        <div className="citem" key={s.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
          <div style={{ minWidth: 0 }}>
            <strong>{s.item?.name ?? "Vare"}</strong>
            {s.item && itemMeta(s.item) ? <span className="from">{itemMeta(s.item)}</span> : null}
          </div>
          <div className="right"><span className="num">{kr(s.price)}</span></div>
        </div>
      ))}
      <div className="order-info">
        <div className="order-lines">
          {discount > 0 ? <span className="discount-line">Samlerabat: −{kr(discount)}</span> : null}
          <span>{DELIVERY[o.delivery].label}: {kr(o.shipping_amount)}</span>
          <span>Køberbeskyttelse: {kr(o.fee_amount)}</span>
          <b>Betalt i alt: {kr(o.total_amount)}</b>
        </div>
        <div className="order-state">
          {o.sp_name ? (
            <span className="muted">
              Til {isCarrier(o.sp_carrier) ? `${CARRIERS[o.sp_carrier].name}-pakkeshop` : "pakkeshop"}: <b style={{ color: "var(--text)" }}>{o.sp_name}</b>
              {o.sp_address ? `, ${o.sp_address}` : ""}
              {o.sp_zipcode ? `, ${o.sp_zipcode} ${o.sp_city ?? ""}` : ""}
            </span>
          ) : null}
          {o.status === "paid" && o.delivery === "ship" ? (
            <span className="muted">
              Betalt {when(o.paid_at)}. {o.sp_name ? "Sælgeren pakker og afleverer din pakke." : "Sælgeren pakker din pakke."}
            </span>
          ) : null}
          {o.status === "paid" && o.delivery === "pickup" ? (
            <span className="muted">Sælgeren kontakter dig om afhentning. Bekræft, når du har hentet varerne.</span>
          ) : null}
          {o.status === "shipped" ? (
            <span className="muted">
              {o.sp_name && trackingText(o.tracking_status) ? `${trackingText(o.tracking_status)} ` : `Sendt ${when(o.shipped_at)}. `}
              {o.tracking ? (
                <>
                  Sporingsnummer{" "}
                  {isCarrier(o.sp_carrier) ? (
                    <a href={CARRIERS[o.sp_carrier].track(o.tracking)} target="_blank" rel="noopener noreferrer">{o.tracking}</a>
                  ) : (
                    o.tracking
                  )}
                  {o.carrier && !o.sp_name ? ` (${o.carrier})` : ""}.{" "}
                </>
              ) : null}
              {o.delivered_at
                ? `Bekræfter du ikke selv, afsluttes ordren automatisk ${DELIVERED_COMPLETE_DAYS} dage efter, at du har hentet pakken.`
                : `Bekræfter du ikke selv, afsluttes ordren automatisk efter ${AUTO_COMPLETE_DAYS} dage.`}
            </span>
          ) : null}
          {o.status === "completed" ? <span className="muted">Modtaget {when(o.completed_at)}. Tak for handlen!</span> : null}
          {o.status === "completed" && rated ? (
            <span className="fine">Du gav {seller?.handle ?? "sælgeren"} {rated.stars} {rated.stars === 1 ? "stjerne" : "stjerner"}.</span>
          ) : o.status === "completed" ? (
            <RateSeller orderId={o.id} handle={seller?.handle ?? "sælgeren"} />
          ) : null}
          {o.status === "refunded" && issue?.resolution !== "refunded" ? (
            <span className="muted">Sælgeren har annulleret ordren, og du har fået pengene tilbage.</span>
          ) : null}
          {o.issue_open && issue ? (
            <div className="issue-note" role="status">
              <b>Du har meldt et problem {when(issue.created_at)}</b>
              <span>
                {isIssueReason(issue.reason) ? ISSUE_REASONS[issue.reason] : "Problem"}: <q>{issue.message}</q>
              </span>
              <span>Pengene holdes tilbage, mens vi kigger på sagen. Vi skriver til dig på mail.</span>
            </div>
          ) : null}
          {!o.issue_open && issue?.resolution && (o.status === "completed" || o.status === "refunded") ? (
            <span className="fine">Sagen om ordren er afgjort. {BUYER_RESOLUTION_TEXT[issue.resolution] ?? ""}</span>
          ) : null}
          {o.status === "shipped" || (o.status === "paid" && o.delivery === "pickup") ? (
            <ConfirmReceived orderId={o.id} pickup={o.delivery === "pickup"} />
          ) : null}
          {(o.status === "paid" || o.status === "shipped") && !o.issue_open ? <ReportProblem orderId={o.id} uid={uid} photosReady={photosReady} business={seller?.seller_type === "business"} /> : null}
        </div>
      </div>
    </section>
  );
}
