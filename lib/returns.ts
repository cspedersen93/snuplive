import type Stripe from "stripe";
import { CARRIERS, isCarrier } from "@/lib/carriers";
import { SITE_URL } from "@/lib/env";
import { kr } from "@/lib/format";
import { adminEmails, sendMail } from "@/lib/mail";
import { releaseOrder, resolveIssues } from "@/lib/orders";
import { cancelLabel, createLabel, ensureTrackingWebhook, findPakkeshops, hasShipmondo } from "@/lib/shipmondo";
import { ore } from "@/lib/stripe";
import type { AdminClient } from "@/lib/supabase/admin";

// Retur i en sag, returfragt som gæld hos sælgeren, og "Relived dækker" (0039_retur_og_daekning.sql).
// Alt her kører kun på serveren og kun for en admin.

export class ReturnError extends Error {}

export interface OrderReturn {
  order_id: string;
  manual: boolean;
  shipment_id: number | null;
  carrier: string | null;
  tracking: string | null;
  labelless_code: string | null;
  sp_name: string | null;
  sp_address: string | null;
  sp_zipcode: string | null;
  sp_city: string | null;
  price: number;
  tracking_status: string | null;
  created_at: string;
  sent_at: string | null;
}

const RETURN_COLS = "order_id,manual,shipment_id,carrier,tracking,labelless_code,sp_name,sp_address,sp_zipcode,sp_city,price,tracking_status,created_at,sent_at";

type Reader = Pick<AdminClient, "from">;

/** Returer for nogle ordrer. Uden 0039: ingen. Virker både med brugerens egen klient og med admin. */
export async function fetchReturns(sb: Reader, orderIds: string[]): Promise<Record<string, OrderReturn>> {
  if (!orderIds.length) return {};
  const { data, error } = await sb.from("order_returns").select(RETURN_COLS).in("order_id", orderIds);
  if (error) return {};
  const out: Record<string, OrderReturn> = {};
  for (const r of (data ?? []) as unknown as OrderReturn[]) out[r.order_id] = r;
  return out;
}

export interface OrderCover {
  order_id: string;
  amount: number;
  started_at: string;
  refunded_at: string | null;
}

/** Ordrer, Relived har dækket. Uden 0039: ingen. */
export async function fetchCovers(sb: Reader, orderIds: string[]): Promise<Record<string, OrderCover>> {
  if (!orderIds.length) return {};
  const { data, error } = await sb.from("order_covers").select("order_id,amount,started_at,refunded_at").in("order_id", orderIds);
  if (error) return {};
  const out: Record<string, OrderCover> = {};
  for (const r of (data ?? []) as unknown as OrderCover[]) out[r.order_id] = r;
  return out;
}

/** Er 0039 kørt? */
export async function returnsReady(sb: Reader): Promise<boolean> {
  return !(await sb.from("order_returns").select("order_id").limit(1)).error;
}

export interface SellerDebt {
  /** Det, sælgeren skylder lige nu. */
  open: number;
  /** Hvad der er trukket fra hvilken udbetaling (ordre-id → kr). */
  byOrder: Record<string, number>;
}

/** Sælgerens gæld (returfragt) og det, der allerede er trukket. Uden 0039: ingen gæld. */
export async function sellerDebt(sb: Reader, sellerId: string): Promise<SellerDebt> {
  const out: SellerDebt = { open: 0, byOrder: {} };
  const { data, error } = await sb
    .from("seller_debts")
    .select("amount,payments:seller_debt_payments(order_id,amount)")
    .eq("seller_id", sellerId);
  if (error) return out;
  for (const d of (data ?? []) as unknown as { amount: number; payments: { order_id: string; amount: number }[] | null }[]) {
    let paid = 0;
    for (const p of d.payments ?? []) {
      paid += p.amount;
      out.byOrder[p.order_id] = (out.byOrder[p.order_id] ?? 0) + p.amount;
    }
    out.open += Math.max(0, d.amount - paid);
  }
  return out;
}

/**
 * Admin giver køberen medhold og beder om varen retur. Var ordren sendt til en pakkeshop, køber Relived en
 * returlabel til en pakkeshop tæt på sælgeren, og prisen bliver sælgerens gæld. Ellers sender køberen selv (manual).
 * Sagen bliver stående åben, og pengene holdes tilbage, indtil admin refunderer.
 */
export async function startReturn(admin: AdminClient, orderId: string) {
  const { data: order } = await admin
    .from("orders")
    .select("id,seller_id,buyer_id,status,delivery,issue_open,shipping_amount,ship_name,ship_line1,ship_line2,ship_postal_code,ship_city,buyer_phone,sp_carrier,sp_id,sp_name,sp_address,sp_zipcode,sp_city,label_weight,buyer:profiles!orders_buyer_id_fkey(handle),seller:profiles!orders_seller_id_fkey(handle)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new ReturnError("Ordren findes ikke.");
  if (!order.issue_open || !["paid", "shipped"].includes(order.status as string)) {
    throw new ReturnError("Der kan kun bedes om retur, mens sagen er åben, og pengene holdes tilbage.");
  }

  // Rækken er låsen: findes den, er der allerede bedt om retur.
  const { error: taken } = await admin.from("order_returns").insert({ order_id: orderId, manual: true });
  if (taken) {
    if (/duplicate|unique/i.test(taken.message)) throw new ReturnError("Der er allerede bedt om retur på den her ordre.");
    throw taken;
  }

  const { data: address } = await admin
    .from("seller_addresses")
    .select("name,address1,address2,zipcode,city,phone")
    .eq("user_id", order.seller_id as string)
    .maybeSingle();
  const [{ data: buyerUser }, { data: sellerUser }] = await Promise.all([
    admin.auth.admin.getUserById(order.buyer_id as string).catch(() => ({ data: null })),
    admin.auth.admin.getUserById(order.seller_id as string).catch(() => ({ data: null })),
  ]);
  const buyerEmail = buyerUser?.user?.email ?? null;
  const sellerEmail = sellerUser?.user?.email ?? null;

  let ret: Partial<OrderReturn> = { manual: true, price: 0 };
  const canLabel = order.delivery === "ship" && isCarrier(order.sp_carrier) && address && hasShipmondo();
  if (canLabel) {
    try {
      const carrier = order.sp_carrier as "dao" | "gls";
      const shops = await findPakkeshops(carrier, address.zipcode, { address: address.address1 });
      const shop = shops[0];
      if (!shop) throw new Error("ingen pakkeshop tæt på sælgeren");
      const label = await createLabel({
        carrier,
        pakkeshopId: shop.id,
        weight: Number(order.label_weight) || 1000,
        reference: `Relived retur ${String(order.id).slice(0, 8)}`,
        sender: {
          name: (order.ship_name as string) || "Relived-køber",
          address1: (order.ship_line1 as string) || (order.sp_address as string) || (order.sp_name as string) || "",
          address2: order.ship_line1 ? (order.ship_line2 as string | null) : null,
          zipcode: ((order.ship_line1 ? order.ship_postal_code : order.sp_zipcode) as string) || (order.sp_zipcode as string) || "",
          city: ((order.ship_line1 ? order.ship_city : order.sp_city) as string) || (order.sp_city as string) || "",
          email: buyerEmail,
          phone: order.buyer_phone as string | null,
        },
        receiver: {
          name: address.name,
          address1: address.address1,
          address2: address.address2,
          zipcode: address.zipcode,
          city: address.city,
          email: sellerEmail,
          phone: address.phone,
        },
      });
      // Shipmondos pris er uden moms; kender vi den ikke, bruger vi det, køberen betalte for fragten.
      const price = Math.max(1, Math.ceil(label.price ?? Number(order.shipping_amount) ?? 0) || Number(order.shipping_amount) || 0);
      ret = {
        manual: false,
        shipment_id: label.shipmentId,
        carrier: CARRIERS[carrier].name,
        tracking: label.pkgNo?.slice(0, 80) ?? null,
        labelless_code: label.labellessCode?.slice(0, 40) ?? null,
        sp_name: shop.name,
        sp_address: shop.address,
        sp_zipcode: shop.zipcode,
        sp_city: shop.city,
        price,
      };
      await ensureTrackingWebhook().catch((e) => console.error("[relived] sporing hos Shipmondo kunne ikke sættes op", e));
    } catch (e) {
      console.error("[relived] returlabel kunne ikke laves, køberen sender selv", orderId, e);
    }
  }

  const { error: saved } = await admin.from("order_returns").update(ret).eq("order_id", orderId);
  if (saved) console.error("[relived] RETURLABEL LAVET MEN IKKE GEMT", orderId, ret.shipment_id, saved);
  // Returfragten bliver først sælgerens gæld, når køberen har sendt pakken (applyTracking i lib/orders.ts).

  const o = order as unknown as { buyer: { handle: string } | null; seller: { handle: string } | null };
  const admins = adminEmails();
  if (buyerEmail) {
    await sendMail({
      to: [buyerEmail],
      replyTo: admins,
      subject: "Send varen retur, så får du pengene tilbage",
      text: [
        "Hej",
        "",
        `Vi har kigget på din sag om ordren fra @${o.seller?.handle ?? "sælgeren"} og giver dig medhold.`,
        "",
        ...(ret.manual
          ? [
              "Send varen retur til sælgeren med sporing inden 7 dage, og svar på den her mail med sporingsnummeret.",
              ...(address ? ["", "Sælgerens adresse:", address.name, address.address1, `${address.zipcode} ${address.city}`] : ["Vi sender dig sælgerens adresse i en mail for sig."]),
            ]
          : [
              "Send varen retur inden 7 dage. Vi har lavet en returlabel til dig, så det koster dig ikke noget.",
              `Hent labelen her: ${SITE_URL}/kurv`,
              ...(ret.labelless_code ? [`Har du ingen printer, så vis koden ${ret.labelless_code} i pakkeshoppen.`] : []),
            ]),
        "",
        "Du får pengene tilbage, når pakken er sendt.",
        "",
        "Venlig hilsen",
        "Relived",
      ].join("\n"),
    });
  }
  if (sellerEmail) {
    await sendMail({
      to: [sellerEmail],
      replyTo: admins,
      subject: "Køberen sender varen retur",
      text: [
        "Hej",
        "",
        `Vi har kigget på sagen om ordren til @${o.buyer?.handle ?? "køberen"} og har givet køberen medhold. Køberen sender varen retur til dig og får pengene tilbage.`,
        "",
        ...(ret.manual
          ? ["Køberen sender selv pakken til din adresse."]
          : [
              `Pakken kommer til ${ret.sp_name}, ${ret.sp_address}, ${ret.sp_zipcode} ${ret.sp_city}. Du får besked, når den kan hentes.`,
              `Returfragten er ${kr(ret.price ?? 0)}. Når køberen har sendt pakken, trækker vi den fra din næste udbetaling.`,
            ]),
        "",
        "Du kan svare på den her mail, hvis du har spørgsmål.",
        "",
        "Venlig hilsen",
        "Relived",
      ].join("\n"),
    });
  }
  return { manual: Boolean(ret.manual), price: ret.price ?? 0 };
}

/**
 * Sagen er afgjort uden retur (udbetalt til sælgeren, lukket eller dækket af Relived): en returlabel, der ikke er
 * brugt, annulleres, så den ikke bliver sendt senere, og sælgeren ikke kommer til at betale for den.
 */
export async function cancelUnusedReturn(admin: AdminClient, orderId: string) {
  const { data: ret, error } = await admin.from("order_returns").select("shipment_id,manual,sent_at").eq("order_id", orderId).maybeSingle();
  if (error || !ret || ret.manual || ret.sent_at || !ret.shipment_id || !hasShipmondo()) return false;
  try {
    await cancelLabel(Number(ret.shipment_id));
    return true;
  } catch (e) {
    console.error("[relived] returlabel kunne ikke annulleres", orderId, e);
    return false;
  }
}

/**
 * "Relived dækker": køberen får alle pengene tilbage, og sælgeren får sin udbetaling alligevel. Tabet er Reliveds.
 * Rækkefølgen er: ordren afsluttes, sælgeren får pengene, køberen refunderes, sagen lukkes. Fejler refusionen,
 * bliver sagen stående åben, og knappen kan trykkes igen (Stripe laver ikke to refusioner).
 */
export async function coverOrder(admin: AdminClient, stripe: Stripe, orderId: string) {
  const { data: order } = await admin
    .from("orders")
    .select("id,status,total_amount,stripe_payment_intent,issue_open")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.stripe_payment_intent || !order.issue_open) return false;
  const { data: cover } = await admin.from("order_covers").select("order_id,refunded_at").eq("order_id", orderId).maybeSingle();
  if (cover?.refunded_at) return false;
  if (!cover) {
    if (!["paid", "shipped"].includes(order.status as string)) return false;
    const { error } = await admin.from("order_covers").insert({ order_id: orderId, amount: order.total_amount });
    if (error) throw error;
  } else if (!["paid", "shipped", "completed"].includes(order.status as string)) return false;

  if (order.status !== "completed") {
    const { error } = await admin
      .from("orders")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", order.status as string);
    if (error) throw error;
    await admin.from("sales").update({ status: "done" }).eq("order_id", orderId).in("status", ["paid", "shipped"]);
  }
  await releaseOrder(admin, stripe, orderId);

  await stripe.refunds.create(
    { payment_intent: order.stripe_payment_intent as string, amount: ore(order.total_amount as number), metadata: { order_id: orderId, cover: "1" } },
    { idempotencyKey: `cover-refund-${orderId}` },
  );
  await admin.from("order_covers").update({ refunded_at: new Date().toISOString() }).eq("order_id", orderId);
  await resolveIssues(admin, orderId, "covered");
  return true;
}
