import { fail, json } from "@/lib/api";
import { unquoteEnv } from "@/lib/env";
import { dailyMaintenance } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Køres af Vercel én gang i døgnet (se vercel.json). */
export async function GET(req: Request) {
  const secret = unquoteEnv(process.env.CRON_SECRET);
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return fail("Ingen adgang.", 401);
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return fail("Betaling er ikke sat op.", 503);
  // Shows, der hænger som live uden livstegn fra studiet, bliver lukket.
  const stale = await admin.rpc("end_stale_shows");
  return json({ ...(await dailyMaintenance(admin, stripe)), staleShowsEnded: stale.data ?? 0 });
}
