import { fail } from "@/lib/api";
import { dac7Year, fetchDac7, mustReport } from "@/lib/dac7";
import { isAdminEmail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Listen til Skattestyrelsen som CSV (semikolon, så den åbner rigtigt i dansk Excel). ?aar=2026&alle=1 */
export async function GET(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const url = new URL(req.url);
  const year = dac7Year(url.searchParams.get("aar") ?? undefined);
  const all = url.searchParams.get("alle") === "1";
  const { rows, error } = await fetchDac7(admin, year);
  if (error) return fail(error.message, 500);

  const head = [
    "Brugernavn", "Navn", "E-mail", "Område", "Type", "Firmanavn", "CVR", "Stripe-konto",
    "Antal salg", "Solgt for (kr)", "1. kvartal (kr)", "2. kvartal (kr)", "3. kvartal (kr)", "4. kvartal (kr)", "Gebyrer (kr)", "Skal indberettes",
  ];
  const lines = rows
    .filter((r) => all || mustReport(r))
    .map((r) =>
      [
        r.handle, r.display_name, r.email, r.area, r.seller_type === "business" ? "Erhverv" : "Privat", r.business_name, r.business_cvr,
        r.stripe_account_id, r.sales, r.amount, r.q1, r.q2, r.q3, r.q4, r.fees, mustReport(r) ? "Ja" : "Nej",
      ].map(cell).join(";"),
    );
  const csv = "﻿" + [head.join(";"), ...lines].join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relived-indberetning-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
