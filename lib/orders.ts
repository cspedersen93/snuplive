import type Stripe from "stripe";
import { CARRIERS, isCarrier } from "@/lib/carriers";
import { SITE_URL } from "@/lib/env";
import { kr } from "@/lib/format";
import { ISSUE_REASONS, type IssueReason } from "@/lib/issues";
import { adminEmails, sendMail } from "@/lib/mail";
import { AUTO_COMPLETE_DAYS, DELIVERED_COMPLETE_DAYS, RESERVATION_DAYS, sellerPayout } from "@/lib/pricing";
import { cancelLabel, createLabel, ensureTrackingWebhook, hasShipmondo } from "@/lib/shipmondo";
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
  sp_id: string | null;
  shipmondo_shipment_id: number | null;
}

const ORDER_COLS =
  "id,checkout_id,buyer_id,seller_id,status,delivery,items_amount,shipping_amount,fee_amount,total_amount,stripe_payment_intent,stripe_charge,stripe_transfer,transfer_status,sp_id,shipmondo_shipment_id";

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

/**
 * Send pengene videre til sælgeren (hvis sælgeren har tilknyttet udbetaling): tingene, og fragten
 * hvis sælgeren selv har sendt pakken. Er pakken sendt med SnupLives label, har fragten betalt labelen.
 */
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
        amount: ore(sellerPayout(order)),
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
 * Er der meldt et problem, afslutter cron-jobbet ikke ordren. Køberen kan stadig selv bekræfte,
 * og en admin kan sende pengene til sælgeren (byAdmin), når sagen er afgjort.
 */
export async function completeOrder(
  admin: AdminClient,
  stripe: Stripe,
  orderId: string,
  buyerId: string | null,
  opts: { byAdmin?: boolean } = {},
) {
  const { data: order } = await admin.from("orders").select("id,buyer_id,status,delivery,issue_open").eq("id", orderId).maybeSingle();
  if (!order || (buyerId && order.buyer_id !== buyerId)) return false;
  if (!buyerId && !opts.byAdmin && order.issue_open) return false;
  const ready =
    order.status === "shipped" || (order.status === "paid" && (order.delivery === "pickup" || Boolean(opts.byAdmin)));
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
  if (order.issue_open) await resolveIssues(admin, orderId, opts.byAdmin ? "released" : "buyer_confirmed");
  await releaseOrder(admin, stripe, orderId);
  return true;
}

/**
 * Refundér en ordre, der ikke er afsluttet endnu: sælgeren kan ikke levere, eller en admin
 * har afgjort en sag til køberens fordel (sellerId = null).
 */
export async function refundOrder(admin: AdminClient, stripe: Stripe, orderId: string, sellerId: string | null) {
  let q = admin.from("orders").select(ORDER_COLS).eq("id", orderId);
  if (sellerId) q = q.eq("seller_id", sellerId);
  const { data: order } = await q.maybeSingle<OrderRow>();
  if (!order || !["paid", "shipped"].includes(order.status) || !order.stripe_payment_intent) return false;

  await stripe.refunds.create(
    { payment_intent: order.stripe_payment_intent, amount: ore(order.total_amount), metadata: { order_id: order.id } },
    { idempotencyKey: `refund-${order.id}` },
  );
  // En label, der ikke er brugt, annulleres, så den ikke kan sendes alligevel.
  if (order.shipmondo_shipment_id && order.status === "paid" && hasShipmondo()) {
    await cancelLabel(order.shipmondo_shipment_id).catch((e) => console.error("[snuplive] label kunne ikke annulleres", order.id, e));
  }
  await admin.from("orders").update({ status: "refunded", cancelled_at: nowIso() }).eq("id", order.id);
  await admin.rpc("release_items_for_order", { p_order: order.id });
  await admin.from("sales").update({ status: "cancelled" }).eq("order_id", order.id);
  await resolveIssues(admin, order.id, "refunded");
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

  // Ordrer med et åbent problem venter, til sagen er afgjort.
  const { data: shipped } = await admin
    .from("orders")
    .select("id")
    .eq("status", "shipped")
    .eq("issue_open", false)
    .lt("shipped_at", days(AUTO_COMPLETE_DAYS));
  const { data: pickups } = await admin
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .eq("delivery", "pickup")
    .eq("issue_open", false)
    .lt("paid_at", days(AUTO_COMPLETE_DAYS));
  // Pakker, der er hentet i pakkeshoppen for mere end to dage siden.
  const { data: delivered } = await admin
    .from("orders")
    .select("id")
    .eq("status", "shipped")
    .eq("issue_open", false)
    .lt("delivered_at", days(DELIVERED_COMPLETE_DAYS));
  const due = new Set([...(shipped ?? []), ...(pickups ?? []), ...(delivered ?? [])].map((o) => o.id as string));
  for (const id of due) {
    if (await completeOrder(admin, stripe, id, null)) result.completed++;
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

  if (hasShipmondo()) {
    await ensureTrackingWebhook().catch((e) => console.error("[snuplive] sporing hos Shipmondo kunne ikke sættes op", e));
  }
  return result;
}

// ── Fragtlabels og sporing ──────────────────────────────────────────────────

export class LabelError extends Error {}

/**
 * Lav fragtlabelen til en ordre, der skal til en pakkeshop. Kun sælgeren selv, og kun én gang:
 * ordren låses, mens Shipmondo laver labelen, så to tryk ikke giver to labels.
 */
export async function createLabelForOrder(admin: AdminClient, orderId: string, sellerId: string, weight: number) {
  const { data: order } = await admin
    .from("orders")
    .select("id,seller_id,buyer_id,status,delivery,ship_name,ship_line1,ship_line2,ship_postal_code,ship_city,buyer_phone,sp_carrier,sp_id,sp_name,sp_address,sp_zipcode,sp_city,shipmondo_shipment_id,label_lock")
    .eq("id", orderId)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (!order) throw new LabelError("Ordren findes ikke.");
  if (order.shipmondo_shipment_id) return { already: true };
  if (order.status !== "paid" || order.delivery !== "ship" || !order.sp_id || !isCarrier(order.sp_carrier)) {
    throw new LabelError("Der kan ikke laves en label til den her ordre.");
  }

  const { data: address } = await admin
    .from("seller_addresses")
    .select("name,address1,address2,zipcode,city,phone")
    .eq("user_id", sellerId)
    .maybeSingle();
  if (!address) throw new LabelError("Udfyld din afsenderadresse først.");

  // Lås ordren. En gammel lås (over 2 minutter) må overtages, hvis noget gik galt sidst.
  const lock = nowIso();
  let { data: locked } = await admin
    .from("orders")
    .update({ label_lock: lock })
    .eq("id", orderId)
    .is("shipmondo_shipment_id", null)
    .is("label_lock", null)
    .select("id");
  if (!locked?.length) {
    ({ data: locked } = await admin
      .from("orders")
      .update({ label_lock: lock })
      .eq("id", orderId)
      .is("shipmondo_shipment_id", null)
      .lt("label_lock", new Date(Date.now() - 120e3).toISOString())
      .select("id"));
  }
  if (!locked?.length) throw new LabelError("Labelen er ved at blive lavet. Vent et øjeblik, og opdatér siden.");

  try {
    const { data: buyer } = await admin.auth.admin.getUserById(order.buyer_id as string);
    const label = await createLabel({
      carrier: order.sp_carrier,
      pakkeshopId: order.sp_id as string,
      weight,
      reference: `SnupLive ${String(order.id).slice(0, 8)}`,
      sender: {
        name: address.name,
        address1: address.address1,
        address2: address.address2,
        zipcode: address.zipcode,
        city: address.city,
        phone: address.phone,
      },
      receiver: {
        name: order.ship_name || "SnupLive-køber",
        // Har køberen ikke skrevet en adresse, bruger vi pakkeshoppens (pakken går alligevel dertil).
        address1: order.ship_line1 || order.sp_address || order.sp_name || "",
        address2: order.ship_line1 ? order.ship_line2 : null,
        zipcode: (order.ship_line1 ? order.ship_postal_code : order.sp_zipcode) || order.sp_zipcode || "",
        city: (order.ship_line1 ? order.ship_city : order.sp_city) || order.sp_city || "",
        email: buyer?.user?.email ?? null,
        phone: order.buyer_phone,
      },
    });
    const { error } = await admin
      .from("orders")
      .update({
        shipmondo_shipment_id: label.shipmentId,
        carrier: CARRIERS[order.sp_carrier].name,
        tracking: label.pkgNo?.slice(0, 80) ?? null,
        labelless_code: label.labellessCode?.slice(0, 40) ?? null,
        label_weight: weight,
        label_created_at: nowIso(),
        label_lock: null,
        tracking_status: "INFORMED",
        tracking_at: nowIso(),
      })
      .eq("id", orderId);
    if (error) {
      console.error("[snuplive] LABEL LAVET MEN IKKE GEMT", orderId, label.shipmentId, error);
      throw new LabelError("Labelen blev lavet, men kunne ikke gemmes. Skriv til kontakt@snuplive.dk.");
    }
    await admin.from("shipping_labels").upsert({
      order_id: orderId,
      shipment_id: label.shipmentId,
      carrier: order.sp_carrier,
      product_code: label.productCode,
      weight,
      price: label.price,
    });
    await ensureTrackingWebhook().catch((e) => console.error("[snuplive] sporing hos Shipmondo kunne ikke sættes op", e));
    return { already: false };
  } catch (e) {
    await admin.from("orders").update({ label_lock: null }).eq("id", orderId).is("shipmondo_shipment_id", null);
    throw e;
  }
}

const MOVING = new Set(["EN_ROUTE", "AVAILABLE_FOR_DELIVERY", "DELIVERED"]);

/** En sporingsbesked fra Shipmondo: opdatér status, og markér pakken som sendt eller hentet. */
export async function applyTracking(admin: AdminClient, ev: Record<string, unknown>) {
  const shipmentId = Number(ev.shipment_id);
  const status = String(ev.current_status ?? "").toUpperCase().slice(0, 40);
  if (!Number.isFinite(shipmentId) || !status) return false;
  const registered = Date.parse(String(ev.current_status_registered_at ?? ""));
  const at = new Date(Number.isFinite(registered) && registered <= Date.now() + 864e5 ? registered : Date.now()).toISOString();

  const { data: order } = await admin
    .from("orders")
    .select("id,status,tracking_at,delivered_at")
    .eq("shipmondo_shipment_id", shipmentId)
    .maybeSingle();
  if (!order) return false;

  // En ældre besked må ikke overskrive en nyere status.
  const newer = !order.tracking_at || Date.parse(order.tracking_at as string) <= Date.parse(at) || status === "DELIVERED";
  const patch: Record<string, unknown> = {};
  if (newer) Object.assign(patch, { tracking_status: status, tracking_at: at });
  if (status === "DELIVERED" && !order.delivered_at) patch.delivered_at = at;
  if (Object.keys(patch).length) await admin.from("orders").update(patch).eq("id", order.id);

  if (MOVING.has(status) && order.status === "paid") {
    const { data: shipped } = await admin
      .from("orders")
      .update({ status: "shipped", shipped_at: at })
      .eq("id", order.id)
      .eq("status", "paid")
      .select("id");
    if (shipped?.length) await admin.from("sales").update({ status: "shipped" }).eq("order_id", order.id).eq("status", "paid");
  }
  return true;
}

// ── Meld et problem ─────────────────────────────────────────────────────────

export class IssueError extends Error {}

/** Luk de åbne sager på en ordre (refunderet, udbetalt, lukket eller bekræftet af køberen). */
export async function resolveIssues(
  admin: AdminClient,
  orderId: string,
  resolution: "refunded" | "released" | "closed" | "buyer_confirmed",
) {
  await admin
    .from("order_issues")
    .update({ status: "resolved", resolution, resolved_at: nowIso() })
    .eq("order_id", orderId)
    .eq("status", "open");
  await admin.from("orders").update({ issue_open: false }).eq("id", orderId);
}

/** Køberen melder et problem. Pengene holdes tilbage, og admin og sælger får en mail. */
export async function reportIssue(admin: AdminClient, orderId: string, buyerId: string, reason: IssueReason, message: string) {
  const { data: order } = await admin
    .from("orders")
    .select(
      "id,buyer_id,seller_id,status,issue_open,total_amount,delivery,tracking,carrier,buyer:profiles!orders_buyer_id_fkey(handle),seller:profiles!orders_seller_id_fkey(handle),show:shows!orders_show_id_fkey(title)",
    )
    .eq("id", orderId)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (!order) throw new IssueError("Ordren findes ikke.");
  if (!["paid", "shipped"].includes(order.status as string)) {
    throw new IssueError("Du kan kun melde et problem, før ordren er afsluttet. Skriv til kontakt@snuplive.dk.");
  }
  if (order.issue_open) throw new IssueError("Du har allerede meldt et problem med den her ordre.");

  const { error } = await admin.from("order_issues").insert({ order_id: orderId, buyer_id: buyerId, reason, message });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new IssueError("Du har allerede meldt et problem med den her ordre.");
    throw error;
  }
  await admin.from("orders").update({ issue_open: true }).eq("id", orderId);

  const o = order as unknown as {
    seller_id: string;
    total_amount: number;
    buyer: { handle: string } | null;
    seller: { handle: string } | null;
    show: { title: string } | null;
  };
  const what = ISSUE_REASONS[reason];
  const admins = adminEmails();
  await sendMail({
    to: admins,
    subject: `Ny sag på SnupLive: ${what}`,
    text: [
      `@${o.buyer?.handle ?? "køber"} har meldt et problem med en ordre fra @${o.seller?.handle ?? "sælger"} (${o.show?.title ?? ""}).`,
      "",
      `Grund: ${what}`,
      `Beskrivelse: ${message}`,
      `Beløb: ${kr(o.total_amount)}`,
      `Ordre: ${orderId}`,
      "",
      `Pengene holdes tilbage. Afgør sagen her: ${SITE_URL}/admin`,
    ].join("\n"),
  });
  const { data: seller } = await admin.auth.admin.getUserById(o.seller_id).catch(() => ({ data: null }));
  const sellerEmail = seller?.user?.email;
  if (sellerEmail) {
    await sendMail({
      to: [sellerEmail],
      replyTo: admins,
      subject: "Køberen har meldt et problem med en ordre",
      text: [
        "Hej",
        "",
        `@${o.buyer?.handle ?? "køberen"} har meldt et problem med ordren fra dit show "${o.show?.title ?? ""}".`,
        "",
        `Grund: ${what}`,
        `Køberen skriver: ${message}`,
        "",
        "Pengene for ordren holdes tilbage, mens SnupLive kigger på sagen. Du kan svare på den her mail, hvis du vil fortælle din side.",
        "",
        "Venlig hilsen",
        "SnupLive",
      ].join("\n"),
    });
  }
}

/** Admin lukker en sag uden at flytte penge. Ordren kan derefter afsluttes som normalt. */
export async function closeIssue(admin: AdminClient, orderId: string) {
  await resolveIssues(admin, orderId, "closed");
}
