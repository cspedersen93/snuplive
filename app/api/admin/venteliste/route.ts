import { fail } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";
import { isWaitlistRole, WAITLIST_ROLES } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Ventelisten som CSV (semikolon, til dansk Excel). Kun bekræftede, eller ?alle=1. */
export async function GET(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const all = new URL(req.url).searchParams.get("alle") === "1";
  let q = admin.from("waitlist").select("email,role,created_at,consent_at,confirmed_at,unsubscribed_at,source").order("created_at");
  if (!all) q = q.not("confirmed_at", "is", null).is("unsubscribed_at", null);
  const { data, error } = await q.limit(50_000);
  if (error) return fail(error.message, 500);
  const head = ["E-mail", "Vil gerne", "Tilmeldt", "Samtykke", "Bekræftet", "Afmeldt", "Kilde"];
  const lines = (data ?? []).map((r) =>
    [r.email, isWaitlistRole(r.role) ? WAITLIST_ROLES[r.role] : r.role, r.created_at, r.consent_at, r.confirmed_at, r.unsubscribed_at, r.source].map(cell).join(";"),
  );
  return new Response("﻿" + [head.join(";"), ...lines].join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="snuplive-venteliste${all ? "-alle" : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
