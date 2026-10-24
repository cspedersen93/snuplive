import Stripe from "stripe";
import { unquoteEnv } from "@/lib/env";

let cached: Stripe | null | undefined;

/** Stripe-klienten på serveren, eller null hvis STRIPE_SECRET_KEY ikke er sat. */
export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = unquoteEnv(process.env.STRIPE_SECRET_KEY);
  if (!key) return (cached = null);
  const config: ConstructorParameters<typeof Stripe>[1] = {
    appInfo: { name: "Relived", url: "https://relived.dk" },
    maxNetworkRetries: 2,
  };
  // Kun til lokale tests mod en falsk Stripe.
  const base = process.env.STRIPE_API_BASE;
  if (base) {
    const u = new URL(base);
    Object.assign(config ?? {}, { host: u.hostname, port: Number(u.port), protocol: u.protocol.replace(":", "") });
  }
  return (cached = new Stripe(key, config));
}

export function stripeTestMode() {
  return unquoteEnv(process.env.STRIPE_SECRET_KEY).startsWith("sk_test_");
}

/** Kroner til øre (Stripe regner i mindste enhed). */
export const ore = (kr: number) => Math.round(kr * 100);
