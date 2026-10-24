import { fail, json } from "@/lib/api";
import { supportCookie, UUID } from "@/lib/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Linket i mailen med svaret (/?hjaelp=<nøgle>): chatten åbner med samtalen, også på en anden enhed. */
export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return fail("Chatten er ikke sat op endnu.", 503);
  const { token } = (await req.json().catch(() => ({}))) as { token?: unknown };
  if (typeof token !== "string" || !UUID.test(token)) return fail("Linket er ikke gyldigt.", 400);
  const { data } = await admin.from("support_threads").select("id").eq("token", token).maybeSingle();
  if (!data) return fail("Samtalen findes ikke længere.", 404);
  const res = json({ ok: true });
  res.cookies.set(supportCookie(token, new URL(req.url).protocol === "https:"));
  return res;
}
