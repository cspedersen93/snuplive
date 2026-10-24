import { fail, json } from "@/lib/api";
import { SITE_URL } from "@/lib/env";
import { adminEmails, sendMail } from "@/lib/mail";
import { isReportReason, isReportTarget, REPORT_REASONS, REPORT_TARGETS } from "@/lib/reports";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PER_HOUR = 10;

/**
 * Alle kan anmelde en ting, et show eller en profil (EU's regler for digitale tjenester).
 * Body: { target_type, target_id, reason, message, email? }. Uden login skal der en e-mail med, så vi kan svare.
 */
export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return fail("Anmeldelser er ikke sat op endnu. Skriv til kontakt@relived.dk.", 503);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isReportTarget(body.target_type) || typeof body.target_id !== "string" || !UUID.test(body.target_id)) {
    return fail("Vi kunne ikke finde det, du vil anmelde.", 400);
  }
  if (!isReportReason(body.reason)) return fail("Vælg, hvad der er galt.", 400);
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (message.length < 10) return fail("Fortæl kort, hvad der er galt (mindst 10 tegn).", 400);

  const user = await getUserInfo(await createClient());
  const typed = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const email = user?.email?.toLowerCase() || typed;
  if (!user && !EMAIL.test(typed)) return fail("Skriv din e-mail, så vi kan svare dig.", 400);

  const type = body.target_type;
  const targetId = body.target_id;

  // Findes det, der bliver anmeldt?
  const target =
    type === "item"
      ? await admin.from("items").select("id,name,seller:profiles!items_seller_id_fkey(handle)").eq("id", targetId).maybeSingle()
      : type === "show"
        ? await admin.from("shows").select("id,title,seller:profiles!shows_seller_id_fkey(handle)").eq("id", targetId).maybeSingle()
        : await admin.from("profiles").select("id,handle").eq("id", targetId).maybeSingle();
  if (!target.data) return fail("Vi kunne ikke finde det, du vil anmelde.", 404);
  const t = target.data as { name?: string; title?: string; handle?: string; seller?: { handle: string } | null };
  const what = t.name ?? t.title ?? `@${t.handle}`;
  const owner = t.seller?.handle ?? t.handle ?? "";

  // Højst 10 anmeldelser i timen fra samme person, og ikke den samme to gange.
  const since = new Date(Date.now() - 3600e3).toISOString();
  const mine = admin.from("reports").select("id,target_id,status", { count: "exact" }).gte("created_at", since);
  const recent = user ? await mine.eq("reporter_id", user.id) : await mine.eq("reporter_email", email);
  if ((recent.count ?? 0) >= PER_HOUR) return fail("Du har sendt mange anmeldelser. Prøv igen om lidt.", 429);
  if ((recent.data ?? []).some((r) => r.target_id === targetId && r.status === "open")) return json({ ok: true });

  const others = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("target_type", type)
    .eq("target_id", targetId)
    .eq("status", "open");

  const { error } = await admin.from("reports").insert({
    target_type: type,
    target_id: targetId,
    reason: body.reason,
    message,
    reporter_id: user?.id ?? null,
    reporter_email: email || null,
  });
  if (error) {
    console.error("[snuplive] anmeldelse kunne ikke gemmes", error);
    return fail("Noget gik galt. Prøv igen, eller skriv til kontakt@relived.dk.", 500);
  }

  // Admins får besked første gang, noget bliver anmeldt.
  if (!others.count) {
    await sendMail({
      to: adminEmails(),
      subject: `Ny anmeldelse: ${REPORT_TARGETS[type]} ${what}`.slice(0, 120),
      text: [
        `Nogen har anmeldt ${REPORT_TARGETS[type]} "${what}"${owner ? ` hos @${owner}` : ""}.`,
        `Grund: ${REPORT_REASONS[body.reason]}`,
        `Besked: ${message}`,
        "",
        `Afgør den her: ${SITE_URL}/admin/anmeldelser`,
      ].join("\n"),
    });
  }
  return json({ ok: true });
}
