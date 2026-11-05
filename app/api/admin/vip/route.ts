import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Admin gør en sælger eller køber til VIP (eller fjerner det igen): { user, role: "seller" | "buyer", value }. */
export async function POST(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const body = (await req.json().catch(() => ({}))) as { user?: unknown; role?: unknown; value?: unknown };
  if (typeof body.user !== "string" || !/^[0-9a-f-]{36}$/i.test(body.user)) return fail("Ukendt medlem.", 400);
  if (body.role !== "seller" && body.role !== "buyer") return fail("Vælg sælger eller køber.", 400);
  if (typeof body.value !== "boolean") return fail("Ugyldig værdi.", 400);
  const col = body.role === "seller" ? "vip_seller_at" : "vip_buyer_at";
  const { data, error } = await admin
    .from("profiles")
    .update({ [col]: body.value ? new Date().toISOString() : null })
    .eq("id", body.user)
    .select("id");
  if (error) return fail(/vip_/.test(error.message) ? "Kør 0032_niveauer.sql i Supabase først." : error.message, 500);
  if (!data?.length) return fail("Medlemmet findes ikke.", 404);
  console.info("[snuplive] admin", user.email, "VIP", body.role, body.user, body.value);
  return json({ ok: true });
}
