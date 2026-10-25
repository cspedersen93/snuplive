import { fail, json } from "@/lib/api";
import { pushEndpointAllowed, vapidKeys } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const B64URL = /^[A-Za-z0-9_-]+=*$/;
const MAX_PER_USER = 10;

/** Den offentlige nøgle, som browseren skal bruge for at kunne modtage beskeder fra Relived. */
export async function GET() {
  const admin = createAdminClient();
  if (!admin) return fail("Ikke sat op.", 503);
  const keys = await vapidKeys(admin);
  if (!keys) return fail("Besked på telefonen er ikke sat op endnu.", 503);
  return json({ key: keys.publicKey });
}

/** Gem browserens adresse til beskeder (en pr. telefon/browser). */
export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return fail("Ikke sat op.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind først.", 401);
  const b = (await req.json().catch(() => null)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = typeof b?.endpoint === "string" ? b.endpoint : "";
  const p256dh = typeof b?.keys?.p256dh === "string" ? b.keys.p256dh : "";
  const auth = typeof b?.keys?.auth === "string" ? b.keys.auth : "";
  if (endpoint.length > 1000 || !pushEndpointAllowed(endpoint)) return fail("Ukendt adresse til beskeder.", 400);
  if (!B64URL.test(p256dh) || p256dh.length < 20 || p256dh.length > 200 || !B64URL.test(auth) || auth.length < 8 || auth.length > 100)
    return fail("Ugyldige nøgler til beskeder.", 400);

  // Samme browser kan have været brugt af en anden konto før. Adressen hører nu til denne bruger.
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await admin.from("push_subscriptions").insert({ user_id: uid, endpoint, p256dh, auth });
  if (error) {
    console.error("[relived] besked på telefonen kunne ikke gemmes", error.message);
    return fail("Besked på telefonen er ikke sat op endnu.", 503);
  }
  // Højst 10 telefoner/browsere pr. bruger: de ældste ryger.
  const { data: rows } = await admin.from("push_subscriptions").select("id").eq("user_id", uid).order("created_at", { ascending: false });
  const extra = (rows ?? []).slice(MAX_PER_USER).map((r) => r.id as string);
  if (extra.length) await admin.from("push_subscriptions").delete().in("id", extra);
  return json({ ok: true });
}

/** Slå beskeder fra på denne telefon/browser. */
export async function DELETE(req: Request) {
  const admin = createAdminClient();
  if (!admin) return fail("Ikke sat op.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind først.", 401);
  const b = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof b?.endpoint === "string" ? b.endpoint : "";
  if (!endpoint) return fail("Mangler adressen.", 400);
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", uid);
  return json({ ok: true });
}
