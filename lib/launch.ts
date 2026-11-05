import { unquoteEnv } from "@/lib/env";

// Relived er "åbnet", når Stripe kører med rigtige nøgler. Indtil da står der "i beta" ved alt, der handler om, at det
// er gratis at sælge, og forsiden taler til sælgerne. Teksterne skifter af sig selv, når de rigtige nøgler ligger i
// Vercel, og der er trykket Redeploy. Kun til serveren (læser STRIPE_SECRET_KEY).

/** Er Relived åbnet (Stripe kører med rigtige nøgler)? */
export function launched() {
  const key = unquoteEnv(process.env.STRIPE_SECRET_KEY);
  return Boolean(key) && !key.startsWith("sk_test_");
}

/** Er vi stadig i beta? Det modsatte af launched(). */
export const inBeta = () => !launched();
