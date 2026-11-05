import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { canResetTestSales } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Slet alle testshows: { confirm: "SLET" }. Nulstiller testsalget og sletter alle shows med varer, chat og bud.
 * Brugere, følgere og nyhedsbrevet bliver. Kun admins, og kun mens betalingen kører i testtilstand.
 */
export async function POST(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  if (!canResetTestSales()) return fail("Stripe kører med rigtige nøgler. Shows kan ikke slettes her.", 409);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "SLET") return fail("Skriv SLET for at bekræfte.", 400);
  const { data, error } = await admin.rpc("admin_delete_test_shows");
  if (error) {
    const missing = /admin_delete_test_shows/.test(error.message) && /find|exist|schema cache/i.test(error.message);
    return fail(missing ? "Kør først 0031_slet_testshows.sql i Supabase." : error.message, missing ? 503 : 409);
  }
  console.info("[relived] admin", user.email, "slettede alle testshows", JSON.stringify(data));
  return json({ ok: true, deleted: data });
}
