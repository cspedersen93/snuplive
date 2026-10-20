import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/AccountNav";
import Avatar from "@/components/Avatar";
import { IconInfo } from "@/components/Icons";
import { itemMeta } from "@/components/Screen";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { CARRIERS, isCarrier, trackingText } from "@/lib/carriers";
import { clock, dayLabel, kr } from "@/lib/format";
import { markCheckoutPaid } from "@/lib/orders";
import { AUTO_COMPLETE_DAYS, DELIVERED_COMPLETE_DAYS, DELIVERY, RESERVATION_DAYS } from "@/lib/pricing";
import { hasShipmondo } from "@/lib/shipmondo";
import { getStripe, stripeTestMode } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import ConfirmReceived from "./ConfirmReceived";
import PayGroups, { type PayGroup } from "./PayGroups";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mine snup", robots: { index: false } };

type Seller = { handle: string; display_name: string | null; avatar_path: string | null };
type ItemInfo = { name: string; size: string | null; condition: string | null };

interface SaleRow {
  id: string;
  price: number;
  created_at: string;
  seller_id: string;
  show_id: string;
  item: ItemInfo | null;
  show: { title: string } | null;
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
  seller: Seller | null;
  show: { title: string } | null;
  sales: { id: string; price: number; item: ItemInfo | null }[];
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
        "id,price,created_at,seller_id,show_id,item:items(name,size,condition),show:shows(title),seller:profiles!sales_seller_id_fkey(handle,display_name,avatar_path),order:orders!sales_order_id_fkey(status)",
      )
      .eq("buyer_id", uid)
      .eq("status", "reserved")
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select(
        "id,status,delivery,items_amount,shipping_amount,fee_amount,total_amount,carrier,tracking,paid_at,shipped_at,completed_at,sp_carrier,sp_name,sp_address,sp_zipcode,sp_city,tracking_status,delivered_at,seller:profiles!orders_seller_id_fkey(handle,display_name,avatar_path),show:shows!orders_show_id_fkey(title),sales:sales!sales_order_id_fkey(id,price,item:items(name,size,condition))",
      )
      .eq("buyer_id", uid)
      .in("status", ["paid", "shipped", "completed", "refunded"])
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);

  const toPay = ((salesQ.data ?? []) as unknown as SaleRow[]).filter(
    (s) => !s.order || ["pending", "cancelled"].includes(s.order.status),
  );
  const orders = (ordersQ.data ?? []) as unknown as OrderRow[];

  const groupsMap = new Map<string, PayGroup>();
  for (const s of toPay) {
    const key = `${s.seller_id}:${s.show_id}`;
    const g =
      groupsMap.get(key) ??
      ({
        key,
        seller: s.seller ?? { handle: "sælger", display_name: null, avatar_path: null },
        showTitle: s.show?.title ?? "",
        deadline: deadline(s.created_at),
        items: [],
      } satisfies PayGroup);
    g.items.push({ id: s.id, name: s.item?.name ?? "Ting", meta: s.item ? itemMeta(s.item) : "", price: s.price });
    groupsMap.set(key, g);
  }
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
            <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", letterSpacing: "-.035em", lineHeight: 1.05, marginTop: 6 }}>Mine snup</h1>
          </div>
        </div>

        {banner === "ok" ? (
          <div className="notice ok" role="status">
            <IconInfo />
            <span><b>Tak for din betaling!</b> Sælgeren får besked og pakker dine ting. Du kan følge ordren herunder.</span>
          </div>
        ) : banner === "venter" ? (
          <div className="notice" role="status">
            <IconInfo />
            <span>Vi venter på bekræftelse fra Stripe. Opdatér siden om lidt.</span>
          </div>
        ) : banner === "afbrudt" ? (
          <div className="notice" role="status">
            <IconInfo />
            <span>Betalingen blev afbrudt. Dine snup er stadig reserveret, så du kan prøve igen.</span>
          </div>
        ) : null}

        {groups.length ? (
          <>
            <div className="sec-mini">
              <h2 className="h3">Til betaling</h2>
              <p className="muted" style={{ fontSize: ".92rem" }}>
                Betal inden {RESERVATION_DAYS} dage, ellers bliver snuppet annulleret, og sælgeren kan sælge tingen igen.
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
            <PayGroups groups={groups} ready={ready} pakkeshop={hasShipmondo()} />
          </>
        ) : null}

        {active.length ? (
          <div className="sec-mini">
            <h2 className="h3">På vej til dig</h2>
            {active.map((o) => (
              <OrderCard key={o.id} o={o} />
            ))}
          </div>
        ) : null}

        {done.length ? (
          <div className="sec-mini">
            <h2 className="h3">Tidligere køb</h2>
            {done.map((o) => (
              <OrderCard key={o.id} o={o} />
            ))}
          </div>
        ) : null}

        {!groups.length && !orders.length ? (
          <div className="empty">
            <p style={{ marginBottom: 14 }}>Du har ikke snuppet noget endnu.</p>
            <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OrderCard({ o }: { o: OrderRow }) {
  const [cls, label] = STATUS[o.status];
  const seller = o.seller;
  return (
    <section className="group" aria-label={`Ordre fra ${seller?.handle ?? "sælger"}`}>
      <div className="group-head">
        <div className="seller-row">
          <Avatar handle={seller?.handle ?? "s"} path={seller?.avatar_path} />
          <div>
            <strong>{seller?.handle ?? "Sælger"}</strong>
            <span className="muted" style={{ fontSize: ".85rem" }}>{o.show?.title}</span>
          </div>
        </div>
        <span className={`chip ${cls}`}>{label}</span>
      </div>
      {o.sales.map((s) => (
        <div className="citem" key={s.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
          <div style={{ minWidth: 0 }}>
            <strong>{s.item?.name ?? "Ting"}</strong>
            {s.item && itemMeta(s.item) ? <span className="from">{itemMeta(s.item)}</span> : null}
          </div>
          <div className="right"><span className="num">{kr(s.price)}</span></div>
        </div>
      ))}
      <div className="order-info">
        <div className="order-lines">
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
            <span className="muted">Sælgeren kontakter dig om afhentning. Bekræft, når du har hentet tingene.</span>
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
          {o.status === "refunded" ? <span className="muted">Sælgeren har annulleret ordren, og du har fået pengene tilbage.</span> : null}
          {o.status === "shipped" || (o.status === "paid" && o.delivery === "pickup") ? (
            <>
              <ConfirmReceived orderId={o.id} pickup={o.delivery === "pickup"} />
              <span className="fine">
                Er noget ikke, som det blev vist? Skriv til kontakt@snuplive.dk, før du bekræfter, så holder vi pengene tilbage.
              </span>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
