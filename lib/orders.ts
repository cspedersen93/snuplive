import type Stripe from "stripe";
import { AUTO_COMPLETE_DAYS, RESERVATION_DAYS } from "@/lib/pricing";
import { ore } from "@/lib/stripe";
import type { AdminClient } from "@/lib/supabase/admin";

// Alt, der flytter penge eller ændrer en ordres status, ligger her og kører kun på serveren.

export interface OrderRow {
  id: string;
  checkout_id: string;
  buyer_id: string;
  seller_id: string;
  status: "pending" | "paid" | "shipped" | "completed" | "cancelled" | "refunded";
  delivery: "ship" | "pickup";
  items_amount: number;
  shipping_amount: number;
  fee_amount: number;
  total_amount: number;
  stripe_payment_intent: string | null;
  stripe_charge: string | null;
  stripe_transfer: string | null;
  transfer_status: "none" | "pending" | "done" | "failed";
}

const ORDER_COLS =
  "id,checkout_id,buyer_id,seller_id,status,delivery,items_amount,shipping_amount,fee_amount,total_amount,stripe_payment_intent,stripe_charge,stripe_transfer,transfer_status";

const nowIso = () => new Date().toISOString();

/** Markér alle ordrer i en betaling som betalt. Kan kaldes flere gange (webhook og retur-side). */
export async function markCheckoutPaid(admin: AdminClient, stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return 0;
  const checkoutId = session.metadata?.checkout_id;
  if (!checkoutId) return 0;

  const pi = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  let charge: string | null = null;
  if (pi) {
    const intent = await stripe.paymentIntents.retrieve(pi);
    charge = typeof intent.latest_charge === "string" ? intent.latest_charge : (intent.latest_charge?.id ?? null);
  }
  const ship = session.collected_information?.shipping_details ?? null;
  const name = ship?.name ?? session.collected_information?.individual_name ?? session.customer_details?.name ?? null;
  const phone = session.customer_details?.phone ?? null;

  const { data: paid, error } = await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: nowIso(),
      cancelled_at: null,
      stripe_session_id: session.id,
      stripe_payment_intent: pi,
      stripe_charge: charge,
      ship_name: name,
      buyer_phone: phone,
    })
    .eq("checkout_id", checkoutId)
    .in("status", ["pending", "cancelled"])
    .select("id,delivery");
  if (error) throw error;
  const ids = (paid ?? []).map((o) => o.id as string);
  if (!ids.length) return 0;

  const shipIds = (paid ?? []).filter((o) => o.delivery === "ship").map((o) => o.id as string);
  if (shipIds.length && ship?.address) {
    await admin
      .from("orders")
      .update({
        ship_line1: ship.address.line1 ?? null,
        ship_line2: ship.address.line2 ?? null,
        ship_postal_code: ship.address.postal_code ?? null,
        ship_city: ship.address.city ?? null,
      })
      .in("id", shipIds);
  }
  await admin.from("sales").update({ status: "paid" }).in("order_id", ids).eq("status", "reserved");
  return ids.length;
}

/** En betaling blev ikke gennemført: ordrerne annulleres, og snuppene kan betales igen. */
export async function cancelCheckout(admin: AdminClient, checkoutId: string) {
  await admin
    .from("orders")
    .update({ status: "cancelled", cancelled_at: nowIso() })
    .eq("checkout_id", checkoutId)
    .eq("status", "pending");
}

/** Send pengene for tingene og fragten videre til sælgeren (hvis sælgeren har tilknyttet udbetaling). */
export async function releaseOrder(admin: AdminClient, stripe: Stripe, orderId: string) {
  const { data: order } = await admin.from("orders").select(ORDER_COLS).eq("id", orderId).maybeSingle<OrderRow>();
  if (!order || order.status !== "completed" || order.transfer_status === "done") return order?.transfer_status ?? "none";

  const { data: acct } = await admin
    .from("payout_accounts")
    .select("stripe_account_id,payouts_enabled")
    .eq("user_id", order.seller_id)
    .maybeSingle();
  if (!acct?.payouts_enabled) {
    await admin.from("orders").update({ transfer_status: "pending" }).eq("id", order.id);
    return "pending";
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: ore(order.items_amount + order.shipping_amount),
        currency: "dkk",
        destination: acct.stripe_account_id as string,
        ...(order.stripe_charge ? { source_transaction: order.stripe_charge } : {}),
        transfer_group: order.checkout_id,
        description: `SnupLive ordre ${order.id.slice(0, 8)}`,
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `transfer-${order.id}` },
    );
    await admin.from("orders").update({ stripe_transfer: transfer.id, transfer_status: "done" }).eq("id", order.id);
    return "done";
  } catch (e) {
    console.error("[snuplive] overførsel fejlede", order.id, e);
    await admin.from("orders").update({ transfer_status: "failed" }).eq("id", order.id);
    return "failed";
  }
}

/**
 * Afslut en ordre (køberen har fået sine ting). Kun fra "sendt", eller "betalt" ved afhentning.
 * buyerId sikrer, at kun køberen selv kan gøre det (cron-jobbet sender null).
 */
export async function completeOrder(admin: AdminClient, stripe: Stripe, orderId: string, buyerId: string | null) {
  const { data: order } = await admin.from("orders").select("id,buyer_id,status,delivery").eq("id", orderId).maybeSingle();
  if (!order || (buyerId && order.buyer_id !== buyerId)) return false;
  const ready = order.status === "shipped" || (order.status === "paid" && order.delivery === "pickup");
  if (!ready) return false;
  // Opdatér kun, hvis status stadig er den samme (så to klik ikke giver to overførsler).
  const { data, error } = await admin
    .from("orders")
    .update({ status: "completed", completed_at: nowIso() })
    .eq("id", orderId)
    .eq("status", order.status)
    .select("id");
  if (error) throw error;
  if (!data?.length) return false;
  await admin.from("sales").update({ status: "done" }).eq("order_id", orderId).in("status", ["paid", "shipped"]);
  await releaseOrder(admin, stripe, orderId);
  return true;
}

/** Refundér en ordre, der ikke er afsluttet endnu (sælgeren kan ikke levere). */
export async function refundOrder(admin: AdminClient, stripe: Stripe, orderId: string, sellerId: string) {
  const { data: order } = await admin
    .from("orders")
    .select(ORDER_COLS)
    .eq("id", orderId)
    .eq("seller_id", sellerId)
    .maybeSingle<OrderRow>();
  if (!order || !["paid", "shipped"].includes(order.status) || !order.stripe_payment_intent) return false;

  await stripe.refunds.create(
    { payment_intent: order.stripe_payment_intent, amount: ore(order.total_amount), metadata: { order_id: order.id } },
    { idempotencyKey: `refund-${order.id}` },
  );
  await admin.from("orders").update({ status: "refunded", cancelled_at: nowIso() }).eq("id", order.id);
  await admin.rpc("release_items_for_order", { p_order: order.id });
  await admin.from("sales").update({ status: "cancelled" }).eq("order_id", order.id);
  return true;
}

/** Hent sælgerens Stripe-status og send ventende udbetalinger, hvis kontoen er klar. */
export async function syncPayoutAccount(admin: AdminClient, stripe: Stripe, accountId: string) {
  const acct = await stripe.accounts.retrieve(accountId);
  const { data } = await admin
    .from("payout_accounts")
    .update({
      payouts_enabled: Boolean(acct.payouts_enabled),
      details_submitted: Boolean(acct.details_submitted),
      updated_at: nowIso(),
    })
    .eq("stripe_account_id", accountId)
    .select("user_id")
    .maybeSingle();
  if (acct.payouts_enabled && data?.user_id) {
    const { data: waiting } = await admin
      .from("orders")
      .select("id")
      .eq("seller_id", data.user_id)
      .eq("status", "completed")
      .in("transfer_status", ["pending", "failed"]);
    for (const o of waiting ?? []) await releaseOrder(admin, stripe, o.id as string);
  }
  return acct;
}

/** Dagligt oprydningsjob: afslut gamle ordrer, send ventende udbetalinger og annullér gamle snup. */
export async function dailyMaintenance(admin: AdminClient, stripe: Stripe) {
  const days = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
  const result = { completed: 0, transfers: 0, expired: 0, cancelledCheckouts: 0 };

  const { data: shipped } = await admin.from("orders").select("id").eq("status", "shipped").lt("shipped_at", days(AUTO_COMPLETE_DAYS));
  const { data: pickups } = await admin
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .eq("delivery", "pickup")
    .lt("paid_at", days(AUTO_COMPLETE_DAYS));
  for (const o of [...(shipped ?? []), ...(pickups ?? [])]) {
    if (await completeOrder(admin, stripe, o.id as string, null)) result.completed++;
  }

  const { data: retry } = await admin.from("orders").select("id").eq("status", "completed").in("transfer_status", ["pending", "failed"]);
  for (const o of retry ?? []) if ((await releaseOrder(admin, stripe, o.id as string)) === "done") result.transfers++;

  const { data: stale } = await admin
    .from("orders")
    .update({ status: "cancelled", cancelled_at: nowIso() })
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 2 * 3600e3).toISOString())
    .select("id");
  result.cancelledCheckouts = stale?.length ?? 0;

  const { data: old } = await admin
    .from("sales")
    .select("id,item_id,order:orders!sales_order_id_fkey(status,created_at)")
    .eq("status", "reserved")
    .lt("created_at", days(RESERVATION_DAYS));
  // En betaling, der er startet inden for den sidste time, kan stadig nå at blive gennemført.
  const hourAgo = Date.now() - 3600e3;
  const expired = (
    (old ?? []) as unknown as { id: string; item_id: string; order: { status: string; created_at: string } | null }[]
  ).filter(
    (s) =>
      !s.order ||
      s.order.status === "cancelled" ||
      (s.order.status === "pending" && Date.parse(s.order.created_at) < hourAgo),
  );
  if (expired.length) {
    await admin.from("sales").update({ status: "cancelled" }).in("id", expired.map((s) => s.id));
    await admin.from("items").update({ status: "unsold", sold_at: null }).in("id", expired.map((s) => s.item_id)).eq("status", "sold");
  }
  result.expired = expired.length;
  return result;
}
