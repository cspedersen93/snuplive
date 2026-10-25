import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { canResetTestSales } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Nulstil testsalg: { confirm: "NULSTIL" }. Sletter alle køb, ordrer, bud, sager, bedømmelser og fragtlabels, så
 * omsætningen starter forfra. Kun admins, og kun mens betalingen kører i testtilstand.
 */
export async function POST(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  if (!canResetTestSales()) return fail("Stripe kører med rigtige nøgler. Rigtige salg kan ikke nulstilles.", 409);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "NULSTIL") return fail('Skriv NULSTIL for at bekræfte.', 400);
  const { data, error } = await admin.rpc("admin_reset_test_sales");
  if (error) {
    const missing = /admin_reset_test_sales/.test(error.message) && /find|exist|schema cache/i.test(error.message);
    return fail(missing ? "Kør først 0021_nulstil_testsalg.sql i Supabase." : error.message, missing ? 503 : 409);
  }
  console.info("[relived] admin", user.email, "nulstillede testsalg", JSON.stringify(data));
  return json({ ok: true, deleted: data });
}
