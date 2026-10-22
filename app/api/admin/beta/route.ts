import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { clearSiteCache } from "@/lib/siteAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function guard() {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return { error: fail("Ingen adgang.", 403) };
  const admin = createAdminClient();
  if (!admin) return { error: fail("Databasen er ikke sat op.", 503) };
  return { admin, user };
}

/** Tilføj en tester, der må se hele siden før lanceringen: { email, note }. */
export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; note?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 200) return fail("Skriv en gyldig e-mail.", 400);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null;
  const { error } = await g.admin.from("beta_access").upsert({ email, note });
  if (error) return fail(error.message, 500);
  clearSiteCache();
  console.info("[snuplive] admin", g.user.email, "tester tilføjet", email);
  return json({ ok: true });
}

/** Fjern en tester: { email }. */
export async function DELETE(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const { error } = await g.admin.from("beta_access").delete().eq("email", email);
  if (error) return fail(error.message, 500);
  clearSiteCache();
  return json({ ok: true });
}
