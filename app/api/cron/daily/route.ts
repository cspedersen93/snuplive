import { fail, json } from "@/lib/api";
import { unquoteEnv } from "@/lib/env";
import { dailyMaintenance } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { sweepSupportNotices } from "@/lib/support";
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
  // Supportchatten: svar, der ikke er sendt på mail endnu, og gamle samtaler, der skal slettes.
  const supportMailed = await sweepSupportNotices(admin, true);
  const supportDeleted = await admin.rpc("support_cleanup");
  // Klip fra live-showene: slettes 14 dage efter salget, og når en ting er fjernet.
  const clipsDeleted = await cleanClips(admin);
  return json({
    ...(await dailyMaintenance(admin, stripe)),
    staleShowsEnded: stale.data ?? 0,
    supportMailed,
    supportDeleted: supportDeleted.data ?? 0,
    clipsDeleted,
  });
}

async function cleanClips(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data, error } = await admin.rpc("clips_to_clean");
  if (error) return 0; // 0015_klip.sql er ikke kørt endnu
  const paths = ((data ?? []) as unknown[]).filter((p): p is string => typeof p === "string" && !!p);
  for (let i = 0; i < paths.length; i += 100) {
    const { error: rmErr } = await admin.storage.from("clips").remove(paths.slice(i, i + 100));
    if (rmErr) console.error("[snuplive] klip blev ikke slettet", rmErr.message);
  }
  return paths.length;
}
