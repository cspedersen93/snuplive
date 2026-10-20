import type Stripe from "stripe";
import { fail, json } from "@/lib/api";
import { unquoteEnv } from "@/lib/env";
import { cancelCheckout, markCheckoutPaid, syncPayoutAccount } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Stripe giver besked her, når en betaling er gennemført, udløbet, eller en sælgers konto er ændret. */
export async function POST(req: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  // Én hemmelighed til betalinger (din konto) og evt. en til sælgernes konti (Connect).
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]
    .map((s) => unquoteEnv(s))
    .filter(Boolean);
  if (!stripe || !admin || !secrets.length) return fail("Betaling er ikke sat op.", 503);

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
      break;
    } catch {
      // prøv den næste
    }
  }
  if (!event) return fail("Ugyldig signatur.", 400);

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await markCheckoutPaid(admin, stripe, event.data.object);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const id = event.data.object.metadata?.checkout_id;
        if (id) await cancelCheckout(admin, id);
        break;
      }
      case "account.updated":
        await syncPayoutAccount(admin, stripe, event.data.object.id);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("[snuplive] webhook fejlede", event.type, e);
    return fail("Kunne ikke behandle hændelsen.", 500);
  }
  return json({ received: true });
}
