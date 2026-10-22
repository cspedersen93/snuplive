import { fail, json } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWaitlistRole, sendConfirmMail } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_AFTER_MS = 10 * 60_000;

/**
 * Skriv dig op til ventelisten: { email, role, consent, website, source }.
 * Man får en mail med et link og er først med, når man har bekræftet. Svaret er det samme, uanset om
 * e-mailen findes i forvejen, så man ikke kan se, hvem der står på listen.
 */
export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return fail("Tilmeldingen er ikke sat op endnu. Skriv til kontakt@snuplive.dk.", 503);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Feltet "website" er skjult, så kun robotter udfylder det.
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!EMAIL.test(email)) return fail("Skriv en gyldig e-mail.", 400);
  if (!isWaitlistRole(body.role)) return fail("Vælg, om du vil købe, sælge eller begge dele.", 400);
  if (body.consent !== true) return fail("Sæt flueben, så vi må sende dig en mail, når vi åbner.", 400);
  const source = typeof body.source === "string" ? body.source.slice(0, 100) : null;
  const now = new Date().toISOString();

  const { data: row } = await admin
    .from("waitlist")
    .select("id,confirm_token,confirmed_at,unsubscribed_at,confirm_sent_at")
    .eq("email", email)
    .maybeSingle();

  if (!row) {
    const { data, error } = await admin
      .from("waitlist")
      .insert({ email, role: body.role, consent_at: now, confirm_sent_at: now, source })
      .select("confirm_token")
      .single();
    if (error || !data) {
      console.error("[snuplive] venteliste", error?.message);
      return fail("Noget gik galt. Prøv igen om lidt.", 500);
    }
    await sendConfirmMail(email, data.confirm_token);
    return json({ ok: true });
  }

  // Allerede bekræftet og ikke afmeldt: intet at gøre.
  if (row.confirmed_at && !row.unsubscribed_at) {
    await admin.from("waitlist").update({ role: body.role }).eq("id", row.id);
    return json({ ok: true });
  }
  // Afmeldt før eller ikke bekræftet endnu: ny bekræftelse, men højst én mail hvert 10. minut.
  const recent = row.confirm_sent_at && Date.now() - Date.parse(row.confirm_sent_at) < RESEND_AFTER_MS;
  const patch: Record<string, unknown> = { role: body.role, consent_at: now };
  if (row.unsubscribed_at) Object.assign(patch, { unsubscribed_at: null, confirmed_at: null });
  if (!recent) patch.confirm_sent_at = now;
  await admin.from("waitlist").update(patch).eq("id", row.id);
  if (!recent) await sendConfirmMail(email, row.confirm_token);
  return json({ ok: true });
}
