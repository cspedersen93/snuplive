import { fail, json } from "@/lib/api";
import { clearFeeFree, endOfDay, FEE_FREE_KEY, feeFreeActive, readFeeFree, type FeeFreeSetting } from "@/lib/feeFree";
import { isAdminEmail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Admin starter eller stopper gratis-kampagnen (0 kr i køberbeskyttelse).
 * Body: { action: "start", until: "ÅÅÅÅ-MM-DD" } eller { action: "stop" }.
 */
export async function POST(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; until?: unknown };
  const now = new Date().toISOString();
  const current = await readFeeFree(admin);
  let value: FeeFreeSetting;
  if (body.action === "start") {
    if (feeFreeActive(current)) return fail("Kampagnen er allerede i gang.", 409);
    const until = typeof body.until === "string" ? endOfDay(body.until) : null;
    if (!until) return fail("Vælg en slutdato.", 400);
    if (Date.parse(until) <= Date.now()) return fail("Slutdatoen skal ligge i fremtiden.", 400);
    if (Date.parse(until) - Date.now() > 370 * 864e5) return fail("Kampagnen kan højst vare et år.", 400);
    value = { from: now, until };
  } else if (body.action === "stop") {
    if (!current || !feeFreeActive(current)) return fail("Kampagnen er ikke i gang.", 409);
    value = { ...current, ended: now, reason: "manual" };
  } else {
    return fail("Ukendt handling.", 400);
  }
  const { error } = await admin.from("settings").upsert({ key: FEE_FREE_KEY, value, updated_at: now });
  if (error) return fail(error.message, 500);
  clearFeeFree();
  console.info("[snuplive] admin", user.email, "gratis-kampagne", body.action, value.until);
  return json({ ok: true });
}
