import type Stripe from "stripe";
import { CARRIERS, isCarrier } from "@/lib/carriers";
import { SITE_URL } from "@/lib/env";
import { kr } from "@/lib/format";
import { ISSUE_REASONS, type IssueReason } from "@/lib/issues";
import { enforceFeeFreeCap, FEE_FREE_CAP } from "@/lib/feeFree";
import { adminEmails, sendMail } from "@/lib/mail";
import { mailIssueDecided, mailOrdersPaid, mailPickupFlag, mailPickupReminder, mailScanMissing } from "@/lib/orderMails";
import { pickupMarks, pickupReady } from "@/lib/pickup";
import {
  AUTO_COMPLETE_DAYS,
  DELIVERED_COMPLETE_DAYS,
  LABEL_FLAG_DAYS,
  PICKUP_FLAG_DAYS,
  PICKUP_NUDGE_HOURS,
  PICKUP_ONE_SIDED_DAYS,
  PICKUP_REMIND_DAYS,
  RESERVATION_DAYS,
  sellerPayout,
} from "@/lib/pricing";
import { cancelLabel, createLabel, ensureTrackingWebhook, hasShipmondo, shipmondoSandbox } from "@/lib/shipmondo";
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
  // Sikkerhedsnet: en betalt ordre, hvor alle varer er faldet fra undervejs (fx annulleret af sælgeren), refunderes
  // med det samme. Mangler der kun nogle af varerne, får Relived besked. Se refundEmptyOrders.
  const empty = await refundEmptyOrders(admin, stripe, session, ids);
  // Sælgeren får besked om at sende, og køberen får sin ordrebekræftelse. Kun for de ordrer, der blev betalt lige nu.
  await mailOrdersPaid(admin, ids.filter((id) => !empty.includes(id)));
  // Gratis-kampagnen stopper af sig selv, når den anslåede udgift rammer loftet. Så får admins en mail.
  try {
    if ((await enforceFeeFreeCap(admin)).stopped) {
      await sendMail({
        to: adminEmails(),
        subject: "Gratis-kampagnen på Relived er stoppet",
        text: [
          `Den anslåede udgift til kampagnen har ramt loftet på ${kr(FEE_FREE_CAP)}, så køberbeskyttelsen koster igen 5 % + 5 kr.`,
          "",
          `Se tallene, eller start kampagnen igen: ${SITE_URL}/admin/indstillinger`,
        ].join("\n"),
      });
    }
  } catch {
    // Betalingen er gennemført uanset.
  }
  return ids.length;
}

/**
 * Betalte ordrer uden varer. Sælgeren kan ikke længere annullere et køb, mens køberen står i betalingen
 * (cancel_reservation i 0042_rettelser.sql), så det her bør ikke ske. Sker det alligevel, skal køberen ikke betale
 * for ingenting: ordren refunderes automatisk, køberen får en mail, og Relived får besked.
 * `sale_count` i betalingens metadata er antallet af varer, da betalingen blev startet. Er der færre nu, får Relived
 * også besked, selv om ingen ordre er helt tom. Giver id'erne på de tomme ordrer (dem skal ingen have ordremails om).
 */
async function refundEmptyOrders(admin: AdminClient, stripe: Stripe, session: Stripe.Checkout.Session, orderIds: string[]) {
  const empty: string[] = [];
  try {
    const { data, error } = await admin.from("sales").select("order_id").in("order_id", orderIds).in("status", ["reserved", "paid"]);
    if (error) return empty; // Kan vi ikke tælle varerne, rører vi ikke ordrerne.
    const lines = new Map<string, number>();
    for (const s of (data ?? []) as { order_id: string }[]) lines.set(s.order_id, (lines.get(s.order_id) ?? 0) + 1);
    const refunded: string[] = [];
    const failed: string[] = [];
    for (const id of orderIds) {
      if (lines.get(id)) continue;
      empty.push(id);
      try {
        if (await refundOrder(admin, stripe, id, null)) {
          refunded.push(id);
          await mailIssueDecided(admin, id, "seller_refund");
        } else failed.push(id);
      } catch (e) {
        console.error("[relived] en betalt ordre uden varer kunne ikke refunderes", id, e);
        failed.push(id);
      }
    }
    const expected = Number(session.metadata?.sale_count);
    const found = [...lines.values()].reduce((a, n) => a + n, 0);
    const short = Number.isInteger(expected) && expected > found;
    if (empty.length || short) {
      await sendMail({
        to: adminEmails(),
        subject: failed.length
          ? "En betalt ordre uden varer kunne ikke refunderes"
          : refunded.length
            ? "En betalt ordre uden varer er refunderet"
            : "En betaling mangler varer",
        text: [
          empty.length
            ? "En køber har betalt for en ordre, hvor varerne var faldet fra, mens betalingen stod åben."
            : "En køber har betalt, men der er færre varer på ordrerne end, da betalingen blev startet. Intet er refunderet automatisk.",
          ...(refunded.length ? [`Refunderet automatisk, og køberen har fået en mail: ${refunded.join(", ")}`] : []),
          ...(failed.length ? [`Kunne IKKE refunderes automatisk. Giv køberen pengene tilbage i Stripe: ${failed.join(", ")}`] : []),
          "",
          ...(Number.isInteger(expected) ? [`Varer, da betalingen blev startet: ${expected}. Varer nu: ${found}.`] : []),
          `Ordrer i betalingen: ${orderIds.join(", ")}`,
          "",
          `Se ordrerne: ${SITE_URL}/admin/ordrer`,
        ].join("\n"),
      });
    }
  } catch (e) {
    console.error("[relived] tjek af betalte ordrer uden varer fejlede", orderIds, e);
  }
  return empty;
}

/** En betaling blev ikke gennemført: ordrerne annulleres, og købene kan betales igen. */
export async function cancelCheckout(admin: AdminClient, checkoutId: string) {
  await admin
    .from("orders")
    .update({ status: "cancelled", cancelled_at: nowIso() })
    .eq("checkout_id", checkoutId)
    .eq("status", "pending");
}

/**
 * Send pengene videre til sælgeren (hvis sælgeren har tilknyttet udbetaling): tingene, og fragten
 * hvis sælgeren selv har sendt pakken. Er pakken sendt med Reliveds label, har fragten betalt labelen.
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

  // Skylder sælgeren returfragt fra en tidligere sag, trækkes den fra her (0039). Beløbet er det samme, hver gang der spørges.
  const gross = sellerPayout(order);
  const debtQ = await admin.rpc("reserve_debt_for_order", { p_order: order.id, p_max: gross });
  const debt = !debtQ.error && typeof debtQ.data === "number" ? Math.min(debtQ.data, gross) : 0;
  if (gross - debt <= 0) {
    await admin.from("orders").update({ transfer_status: "done" }).eq("id", order.id);
    return "done";
  }
  // Har Relived dækket ordren og allerede refunderet køberen, er der ingen betaling at tage pengene fra.
  const coverQ = await admin.from("order_covers").select("refunded_at").eq("order_id", order.id).maybeSingle();
  const fromCharge = order.stripe_charge && !(!coverQ.error && coverQ.data?.refunded_at);

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: ore(gross - debt),
        currency: "dkk",
        destination: acct.stripe_account_id as string,
        ...(fromCharge ? { source_transaction: order.stripe_charge as string } : {}),
        transfer_group: order.checkout_id,
        description: `Relived ordre ${order.id.slice(0, 8)}`,
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
 * Afhentning: med 0041_afhentning.sql afsluttes ordren kun, når køber og sælger begge har bekræftet (se
 * confirmPickup). Uden filen gælder den gamle regel, hvor køberen bekræfter alene.
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
  let ready = order.status === "shipped" || (order.status === "paid" && Boolean(opts.byAdmin));
  if (!ready && order.status === "paid" && order.delivery === "pickup") {
    const marks = await pickupMarks(admin, orderId);
    ready = !marks || Boolean(marks.buyer && marks.seller);
  }
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

export class PickupError extends Error {}

/**
 * Afhentning (0041_afhentning.sql): køber eller sælger bekræfter, at varerne har skiftet hænder. Ordren afsluttes
 * først, når begge har bekræftet, og så sendes pengene til sælgeren. Kan kaldes flere gange.
 * Svaret fortæller, hvem der har bekræftet, og om ordren er afsluttet.
 */
export async function confirmPickup(admin: AdminClient, stripe: Stripe, orderId: string, uid: string) {
  const { data: order, error } = await admin
    .from("orders")
    .select("id,buyer_id,seller_id,status,delivery,issue_open,pickup_buyer_at,pickup_seller_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order || (order.buyer_id !== uid && order.seller_id !== uid)) throw new PickupError("Ordren findes ikke.");
  if (order.delivery !== "pickup") throw new PickupError("Ordren skal ikke afhentes.");
  if (order.status === "completed") return { buyer: true, seller: true, done: true };
  if (order.status !== "paid") throw new PickupError("Ordren kan ikke bekræftes lige nu. Opdatér siden.");
  const role = order.buyer_id === uid ? "buyer" : "seller";
  // Har køberen meldt et problem, kan sælgeren ikke bekræfte sig til pengene. Sagen skal afgøres først.
  if (role === "seller" && order.issue_open) {
    throw new PickupError("Køberen har meldt et problem med ordren. Afhentningen kan først bekræftes, når Relived har kigget på sagen.");
  }
  const col = role === "buyer" ? "pickup_buyer_at" : "pickup_seller_at";
  if (!order[col]) {
    const { error: markErr } = await admin.from("orders").update({ [col]: nowIso() }).eq("id", orderId).eq("status", "paid").is(col, null);
    if (markErr) throw markErr;
  }
  // Køberen står med varen og siger god for den. Så er et meldt problem løst, ligesom når køberen bekræfter en pakke.
  if (role === "buyer" && order.issue_open) await resolveIssues(admin, orderId, "buyer_confirmed");
  // Læs igen: den anden kan have bekræftet i mellemtiden. completeOrder tjekker selv, at begge har bekræftet,
  // og at ordren ikke allerede er afsluttet, så to tryk på samme tid giver kun én udbetaling.
  const marks = await pickupMarks(admin, orderId);
  let done = false;
  if (marks?.buyer && marks.seller) {
    done = await completeOrder(admin, stripe, orderId, null);
    if (!done) {
      const { data: now } = await admin.from("orders").select("status").eq("id", orderId).maybeSingle();
      done = now?.status === "completed";
    }
  }
  return { buyer: Boolean(marks?.buyer), seller: Boolean(marks?.seller), done };
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

/** Dagligt oprydningsjob: afslut gamle ordrer, send ventende udbetalinger og annullér gamle ubetalte køb. */
export async function dailyMaintenance(admin: AdminClient, stripe: Stripe) {
  const days = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
  const result = { completed: 0, transfers: 0, expired: 0, cancelledCheckouts: 0, pickupReminders: 0, pickupFlagged: 0, scanFlagged: 0 };

  // Ordrer med et åbent problem venter, til sagen er afgjort.
  const { data: shipped } = await admin
    .from("orders")
    .select("id")
    .eq("status", "shipped")
    .eq("issue_open", false)
    .lt("shipped_at", days(AUTO_COMPLETE_DAYS));
  // Afhentning: med 0041_afhentning.sql afsluttes ordren kun, når køber og sælger begge har bekræftet. Det sker
  // normalt med det samme i confirmPickup, så her fanges kun dem, der blev afbrudt undervejs. Uden filen gælder
  // den gamle regel: 7 dage efter betalingen.
  // Kan det ikke afgøres lige nu (databasen svarer ikke), springes afhentningerne over i dag, så ingen får penge ved en fejl.
  const bothConfirm = await pickupReady(admin).catch((e) => {
    console.error("[relived] afhentning kunne ikke tjekkes, så de springes over i dag", e);
    return null;
  });
  let pickups: { id: string }[] | null = null;
  if (bothConfirm !== null) {
    let pickupQ = admin.from("orders").select("id").eq("status", "paid").eq("delivery", "pickup").eq("issue_open", false);
    pickupQ = bothConfirm
      ? pickupQ.not("pickup_buyer_at", "is", null).not("pickup_seller_at", "is", null)
      : pickupQ.lt("paid_at", days(AUTO_COMPLETE_DAYS));
    pickups = (await pickupQ).data as { id: string }[] | null;
  }
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
  if (bothConfirm) Object.assign(result, await pickupFollowUp(admin));
  Object.assign(result, await labelFollowUp(admin));

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
    // Tingen kan købes igen. Er showet slut, kommer den til salg med Køb nu.
    await admin
      .from("items")
      .update({ status: "unsold", sold_at: null, for_sale: true, listed_at: new Date().toISOString() })
      .in("id", expired.map((s) => s.item_id))
      .eq("status", "sold");
  }
  result.expired = expired.length;

  if (hasShipmondo()) {
    await ensureTrackingWebhook().catch((e) => console.error("[snuplive] sporing hos Shipmondo kunne ikke sættes op", e));
  }
  return result;
}

/**
 * Afhentninger, der ikke er bekræftet af begge (0041_afhentning.sql). Ordren afsluttes ikke af sig selv:
 *  - har kun den ene bekræftet, får den anden en påmindelse ved næste daglige kørsel,
 *  - har ingen bekræftet PICKUP_REMIND_DAYS dage efter betalingen, får begge en påmindelse,
 *  - og er ordren stadig ikke bekræftet af begge, får Relived besked og afgør den under Sager.
 * Tidsstemplet sættes, før mailen sendes, så en fejl i mailen ikke giver en ny mail hver dag.
 */
async function pickupFollowUp(admin: AdminClient) {
  const out = { pickupReminders: 0, pickupFlagged: 0 };
  const { data, error } = await admin
    .from("orders")
    .select("id,paid_at,pickup_buyer_at,pickup_seller_at,pickup_reminded_at,pickup_flagged_at")
    .eq("status", "paid")
    .eq("delivery", "pickup")
    .eq("issue_open", false);
  if (error) {
    console.error("[relived] afhentninger kunne ikke hentes", error.message);
    return out;
  }
  const hours = (iso: string | null) => (iso ? (Date.now() - Date.parse(iso)) / 36e5 : 0);
  type Row = {
    id: string;
    paid_at: string | null;
    pickup_buyer_at: string | null;
    pickup_seller_at: string | null;
    pickup_reminded_at: string | null;
    pickup_flagged_at: string | null;
  };
  for (const o of (data ?? []) as Row[]) {
    if (o.pickup_buyer_at && o.pickup_seller_at) continue; // afsluttes af jobbet ovenfor
    const one = o.pickup_buyer_at ?? o.pickup_seller_at;
    // Påmindelsen sendes igen, hvis den sidste blev sendt, før den ene bekræftede.
    const again = Boolean(one && o.pickup_reminded_at && Date.parse(o.pickup_reminded_at) < Date.parse(one));
    const remind = one
      ? hours(one) >= PICKUP_NUDGE_HOURS && (!o.pickup_reminded_at || again)
      : !o.pickup_reminded_at && hours(o.paid_at) >= PICKUP_REMIND_DAYS * 24;
    if (remind) {
      // Kun den kørsel, der når at sætte tidsstemplet, sender mailen.
      let q = admin.from("orders").update({ pickup_reminded_at: nowIso() }).eq("id", o.id).eq("status", "paid");
      q = again && one ? q.lt("pickup_reminded_at", one) : q.is("pickup_reminded_at", null);
      const { data: mine } = await q.select("id");
      if (mine?.length) {
        await mailPickupReminder(admin, o.id, { buyer: Boolean(o.pickup_buyer_at), seller: Boolean(o.pickup_seller_at) });
        out.pickupReminders++;
      }
    }
    const flag = !o.pickup_flagged_at && ((one && hours(one) >= PICKUP_ONE_SIDED_DAYS * 24) || hours(o.paid_at) >= PICKUP_FLAG_DAYS * 24);
    if (flag) {
      const { data: mine } = await admin.from("orders").update({ pickup_flagged_at: nowIso() }).eq("id", o.id).eq("status", "paid").is("pickup_flagged_at", null).select("id");
      if (mine?.length) {
        await mailPickupFlag(admin, o.id);
        out.pickupFlagged++;
      }
    }
  }
  return out;
}

/**
 * Pakker med Reliveds label, som fragtfirmaet ikke har scannet LABEL_FLAG_DAYS dage efter, at labelen blev lavet
 * (0042_rettelser.sql). Ordren står stadig som betalt, for kun scanningen tæller som sendt. Sælgeren får en mail,
 * og Relived får besked og afgør ordren under Sager (markér som sendt, eller refundér). Kun én gang pr. ordre.
 * Testlabels (sandbox) bliver aldrig scannet, så dér sendes der ikke noget. Uden filen sker der ingenting.
 */
async function labelFollowUp(admin: AdminClient) {
  const out = { scanFlagged: 0 };
  if (!hasShipmondo() || shipmondoSandbox()) return out;
  const { data, error } = await admin
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .eq("delivery", "ship")
    .eq("issue_open", false)
    .not("shipmondo_shipment_id", "is", null)
    .is("scan_flagged_at", null)
    .lt("label_created_at", new Date(Date.now() - LABEL_FLAG_DAYS * 864e5).toISOString());
  if (error) return out; // 0042 er ikke kørt endnu
  for (const o of (data ?? []) as { id: string }[]) {
    // Kun den kørsel, der når at sætte tidsstemplet, sender mailene.
    const { data: mine } = await admin.from("orders").update({ scan_flagged_at: nowIso() }).eq("id", o.id).eq("status", "paid").is("scan_flagged_at", null).select("id");
    if (!mine?.length) continue;
    await mailScanMissing(admin, o.id);
    out.scanFlagged++;
  }
  return out;
}

/**
 * Relived markerer en pakke som sendt, selv om sporingen ikke har registreret den (Admin → Sager). Bruges, når
 * fragtfirmaets egen sporing viser, at pakken er afleveret. Derefter følger ordren den normale vej.
 */
export async function markShippedByAdmin(admin: AdminClient, orderId: string) {
  const { data } = await admin
    .from("orders")
    .update({ status: "shipped", shipped_at: nowIso() })
    .eq("id", orderId)
    .eq("status", "paid")
    .eq("delivery", "ship")
    .select("id");
  if (!data?.length) return false;
  await admin.from("sales").update({ status: "shipped" }).eq("order_id", orderId).eq("status", "paid");
  return true;
}

/**
 * Testlabels (Shipmondos sandbox) bliver aldrig scannet af et fragtfirma. For at hele forløbet kan prøves i
 * testfasen, kan sælgeren dér selv markere pakken som afleveret. Med rigtige labels tæller kun scanningen.
 */
export async function markHandedInTest(admin: AdminClient, orderId: string, sellerId: string) {
  if (!shipmondoSandbox()) return false;
  const { data } = await admin
    .from("orders")
    .update({ status: "shipped", shipped_at: nowIso() })
    .eq("id", orderId)
    .eq("seller_id", sellerId)
    .eq("status", "paid")
    .eq("delivery", "ship")
    .not("shipmondo_shipment_id", "is", null)
    .select("id");
  if (!data?.length) return false;
  await admin.from("sales").update({ status: "shipped" }).eq("order_id", orderId).eq("status", "paid");
  return true;
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
      reference: `Relived ${String(order.id).slice(0, 8)}`,
      sender: {
        name: address.name,
        address1: address.address1,
        address2: address.address2,
        zipcode: address.zipcode,
        city: address.city,
        phone: address.phone,
      },
      receiver: {
        name: order.ship_name || "Relived-køber",
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
      throw new LabelError("Labelen blev lavet, men kunne ikke gemmes. Skriv til kontakt@relived.dk.");
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
/**
 * Returfragten bliver sælgerens gæld (0039), når køberen faktisk har sendt returpakken. Ikke før: bliver labelen
 * aldrig brugt, skal sælgeren ikke betale for den. Og ikke, hvis sagen er afgjort uden retur (udbetalt, lukket
 * eller dækket af Relived). Kan kaldes flere gange: der kan kun være én gæld pr. ordre.
 */
async function chargeReturnFreight(admin: AdminClient, orderId: string, price: number) {
  if (!(price > 0)) return;
  const { data: o } = await admin.from("orders").select("seller_id,status,issue_open").eq("id", orderId).maybeSingle();
  if (!o || !(o.issue_open || o.status === "refunded")) return;
  const { error } = await admin.from("seller_debts").insert({ seller_id: o.seller_id, order_id: orderId, amount: price });
  if (error && !/duplicate|unique/i.test(error.message)) console.error("[relived] returfragt kunne ikke noteres som gæld", orderId, error);
}

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
  if (!order) {
    // Måske er det en returpakke (0039): notér, at køberen har sendt den.
    const ret = await admin.from("order_returns").select("order_id,sent_at,manual,price").eq("shipment_id", shipmentId).maybeSingle();
    if (ret.error || !ret.data) return false;
    const patch: Record<string, unknown> = { tracking_status: status };
    if (MOVING.has(status) && !ret.data.sent_at) patch.sent_at = at;
    await admin.from("order_returns").update(patch).eq("order_id", ret.data.order_id);
    if (MOVING.has(status) && !ret.data.manual) await chargeReturnFreight(admin, ret.data.order_id as string, Number(ret.data.price) || 0);
    return true;
  }

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
  resolution: "refunded" | "released" | "closed" | "buyer_confirmed" | "covered",
) {
  await admin
    .from("order_issues")
    .update({ status: "resolved", resolution, resolved_at: nowIso() })
    .eq("order_id", orderId)
    .eq("status", "open");
  await admin.from("orders").update({ issue_open: false }).eq("id", orderId);
}

/** Køberen melder et problem. Pengene holdes tilbage, og admin og sælger får en mail. */
export async function reportIssue(admin: AdminClient, orderId: string, buyerId: string, reason: IssueReason, message: string, photos: string[] = []) {
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
    throw new IssueError("Du kan kun melde et problem, før ordren er afsluttet. Skriv til kontakt@relived.dk.");
  }
  if (order.issue_open) throw new IssueError("Du har allerede meldt et problem med den her ordre.");

  // Billederne skal faktisk ligge i lageret. Før 0038 er kørt, findes kolonnen ikke, og sagen gemmes uden billeder.
  const row: Record<string, unknown> = { order_id: orderId, buyer_id: buyerId, reason, message };
  if (photos.length) row.photos = photos;
  let { error } = await admin.from("order_issues").insert(row);
  if (error && photos.length && /photos/i.test(error.message) && /column|schema/i.test(error.message)) {
    photos = [];
    ({ error } = await admin.from("order_issues").insert({ order_id: orderId, buyer_id: buyerId, reason, message }));
  }
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
    subject: `Ny sag på Relived: ${what}`,
    text: [
      `@${o.buyer?.handle ?? "køber"} har meldt et problem med en ordre fra @${o.seller?.handle ?? "sælger"} (${o.show?.title ?? ""}).`,
      "",
      `Grund: ${what}`,
      `Beskrivelse: ${message}`,
      `Billeder fra køberen: ${photos.length ? photos.length : "ingen"}`,
      `Beløb: ${kr(o.total_amount)}`,
      `Ordre: ${orderId}`,
      "",
      `Pengene holdes tilbage. Afgør sagen her: ${SITE_URL}/admin/sager`,
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
        ...(photos.length ? [`Køberen har vedhæftet ${photos.length === 1 ? "et billede" : `${photos.length} billeder`}. Du kan se dem på ordren i dit studie.`] : []),
        "",
        "Pengene for ordren holdes tilbage, mens Relived kigger på sagen. Du kan svare på den her mail, hvis du vil fortælle din side.",
        "",
        "Venlig hilsen",
        "Relived",
      ].join("\n"),
    });
  }
}

/** Admin lukker en sag uden at flytte penge. Ordren kan derefter afsluttes som normalt. */
export async function closeIssue(admin: AdminClient, orderId: string) {
  await resolveIssues(admin, orderId, "closed");
}
