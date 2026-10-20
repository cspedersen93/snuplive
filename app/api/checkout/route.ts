import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { fail, json } from "@/lib/api";
import { SITE_URL } from "@/lib/env";
import { cancelCheckout, markCheckoutPaid } from "@/lib/orders";
import { DELIVERY, isDelivery, orderAmounts, type Delivery } from "@/lib/pricing";
import { getStripe, ore } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SaleRow {
  id: string;
  item_id: string;
  show_id: string;
  seller_id: string;
  price: number;
  order_id: string | null;
  item: { name: string; size: string | null; condition: string | null } | null;
  show: { title: string } | null;
  seller: { handle: string } | null;
  order: { id: string; status: string; checkout_id: string; stripe_session_id: string | null } | null;
}

/**
 * Start en betaling for alle køberens ubetalte snup.
 * Body: { deliveries: { "<sælger-id>:<show-id>": "ship" | "pickup" } }
 * Beløbene regnes ud her på serveren, ikke i browseren.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return fail("Betaling er ikke sat op endnu.", 503);

  const supabase = await createClient();
  const user = await getUserInfo(supabase);
  if (!user) return fail("Log ind for at betale.", 401);

  const body = (await req.json().catch(() => ({}))) as { deliveries?: Record<string, unknown> };
  const deliveries = body.deliveries ?? {};

  const { data, error } = await admin
    .from("sales")
    .select(
      "id,item_id,show_id,seller_id,price,order_id,item:items(name,size,condition),show:shows(title),seller:profiles!sales_seller_id_fkey(handle),order:orders!sales_order_id_fkey(id,status,checkout_id,stripe_session_id)",
    )
    .eq("buyer_id", user.id)
    .eq("status", "reserved");
  if (error) return fail("Dine snup kunne ikke hentes. Prøv igen.", 500);
  const payable = ((data ?? []) as unknown as SaleRow[]).filter((s) => !s.order || ["pending", "cancelled"].includes(s.order.status));
  if (!payable.length) return fail("Der er ikke noget at betale.", 400);

  // Gamle, ubetalte betalinger lukkes, så man ikke kan betale to gange.
  const oldSessions = new Map<string, string>();
  for (const s of payable) {
    if (s.order?.status === "pending" && s.order.stripe_session_id) oldSessions.set(s.order.stripe_session_id, s.order.checkout_id);
  }
  for (const [sessionId, checkoutId] of oldSessions) {
    try {
      const old = await stripe.checkout.sessions.retrieve(sessionId);
      if (old.status === "complete" && old.payment_status === "paid") {
        await markCheckoutPaid(admin, stripe, old);
        return fail("Du har allerede betalt. Opdatér siden.", 409);
      }
      if (old.status === "open") await stripe.checkout.sessions.expire(sessionId);
    } catch {
      // Sessionen findes ikke længere
    }
    await cancelCheckout(admin, checkoutId);
  }

  // Én ordre pr. sælger og show (alt sendes i én pakke).
  const groups = new Map<string, SaleRow[]>();
  for (const s of payable) {
    const key = `${s.seller_id}:${s.show_id}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const checkoutId = randomUUID();
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let anyShip = false;
  let feeTotal = 0;
  const created: string[] = [];

  for (const [key, sales] of groups) {
    const delivery: Delivery = isDelivery(deliveries[key]) ? (deliveries[key] as Delivery) : "ship";
    if (delivery === "ship") anyShip = true;
    const items = sales.reduce((a, s) => a + s.price, 0);
    const amounts = orderAmounts(items, delivery);
    feeTotal += amounts.fee;
    const handle = sales[0].seller?.handle ?? "sælger";

    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        checkout_id: checkoutId,
        buyer_id: user.id,
        seller_id: sales[0].seller_id,
        show_id: sales[0].show_id,
        delivery,
        items_amount: amounts.items,
        shipping_amount: amounts.shipping,
        fee_amount: amounts.fee,
        total_amount: amounts.total,
      })
      .select("id")
      .single();
    if (oErr || !order) {
      await cancelCheckout(admin, checkoutId);
      return fail("Betalingen kunne ikke startes. Prøv igen.", 500);
    }
    created.push(order.id as string);
    await admin.from("sales").update({ order_id: order.id }).in("id", sales.map((s) => s.id)).eq("status", "reserved");

    for (const s of sales) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "dkk",
          unit_amount: ore(s.price),
          product_data: {
            name: s.item?.name ?? "Ting",
            description: [s.item?.size ? `Str. ${s.item.size}` : null, s.item?.condition, `fra @${handle}`].filter(Boolean).join(" · "),
          },
        },
      });
    }
    if (amounts.shipping > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "dkk",
          unit_amount: ore(amounts.shipping),
          product_data: { name: `Fragt fra @${handle}`, description: DELIVERY[delivery].label },
        },
      });
    }
  }

  lineItems.push({
    quantity: 1,
    price_data: {
      currency: "dkk",
      unit_amount: ore(feeTotal),
      product_data: {
        name: "Køberbeskyttelse",
        description: "Pengene holdes tilbage, til du har fået dine ting",
      },
    },
  });

  const origin = new URL(req.url).origin || SITE_URL;
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        locale: "da",
        line_items: lineItems,
        customer_email: user.email ?? undefined,
        client_reference_id: user.id,
        phone_number_collection: { enabled: true },
        ...(anyShip ? { shipping_address_collection: { allowed_countries: ["DK"] } } : {}),
        payment_intent_data: {
          transfer_group: checkoutId,
          description: "Køb på SnupLive",
          metadata: { checkout_id: checkoutId, buyer_id: user.id },
        },
        metadata: { checkout_id: checkoutId, buyer_id: user.id },
        custom_text: {
          submit: { message: "SnupLive holder pengene tilbage, indtil du har fået dine ting." },
        },
        expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
        success_url: `${origin}/kurv?betaling={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/kurv?betaling=annulleret`,
      },
      { idempotencyKey: `checkout-${checkoutId}` },
    );
    await admin.from("orders").update({ stripe_session_id: session.id }).eq("checkout_id", checkoutId);
    return json({ url: session.url });
  } catch (e) {
    console.error("[snuplive] checkout fejlede", e);
    await cancelCheckout(admin, checkoutId);
    return fail("Betalingen kunne ikke startes hos Stripe. Prøv igen om lidt.", 502);
  }
}
