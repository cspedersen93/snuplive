import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { mitidEnabled } from "@/lib/mitid";
import { clearSiteCache } from "@/lib/siteAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KEYS = new Set(["mitid_required", "site_open", "test_banner"]);

/** Admin slår en indstilling til eller fra: { key, value }. */
export async function POST(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const body = (await req.json().catch(() => ({}))) as { key?: unknown; value?: unknown };
  // test_banner kan også sættes til null: så bestemmer betalingen (vises i testtilstand).
  const valueOk = typeof body.value === "boolean" || (body.key === "test_banner" && body.value === null);
  if (typeof body.key !== "string" || !KEYS.has(body.key) || !valueOk) return fail("Ukendt indstilling.", 400);
  // Kravet må ikke slås til, før MitID virker, ellers kan ingen sælgere gå live.
  if (body.key === "mitid_required" && body.value && !mitidEnabled()) {
    return fail("MitID er ikke sat op endnu. Læg nøglerne fra Idura ind i Vercel først.", 409);
  }
  // "Automatisk" gemmes som "auto" (feltet må ikke være tomt).
  const value = body.value === null ? "auto" : body.value;
  const { error } = await admin.from("settings").upsert({ key: body.key, value, updated_at: new Date().toISOString() });
  if (error) return fail(error.message, 500);
  clearSiteCache();
  console.info("[snuplive] admin", user.email, "indstilling", body.key, body.value);
  return json({ ok: true });
}
