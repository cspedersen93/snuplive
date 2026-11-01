import { after } from "next/server";
import { fail, json } from "@/lib/api";
import { sweepSearchAlerts } from "@/lib/searchAlerts";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * En sælger har lagt noget op (en vare i køen, en videoannonce, eller showet er slut): kør søgeagenterne efter svaret.
 * Højst hvert 15. sekund pr. server (se lib/searchAlerts.ts), så det er ufarligt at kalde ofte.
 */
export async function POST() {
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind først.", 401);
  after(() => sweepSearchAlerts(15_000));
  return json({ ok: true });
}
