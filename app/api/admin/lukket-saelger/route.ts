import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Admin åbner en sælger, Relived har lukket (0042_rettelser.sql): { user }. Lukningen slettes, og medlemmet kan
 * derefter selv trykke "Bliv sælger" igen. Varer og shows, der blev fjernet ved lukningen, kommer ikke tilbage.
 */
export async function POST(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const body = (await req.json().catch(() => ({}))) as { user?: unknown };
  if (typeof body.user !== "string" || !/^[0-9a-f-]{36}$/i.test(body.user)) return fail("Ukendt medlem.", 400);
  const { data, error } = await admin.from("seller_closures").delete().eq("user_id", body.user).select("user_id");
  if (error) return fail(/seller_closures/.test(error.message) ? "Kør 0042_rettelser.sql i Supabase først." : error.message, 500);
  if (!data?.length) return fail("Sælgerprofilen er ikke lukket.", 404);
  console.info("[relived] admin", user.email, "åbner sælger", body.user);
  return json({ ok: true });
}
