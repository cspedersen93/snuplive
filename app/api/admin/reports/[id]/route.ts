import { revalidatePath } from "next/cache";
import { fail, json } from "@/lib/api";
import { COMPANY } from "@/lib/company";
import { isAdminEmail, sendMail } from "@/lib/mail";
import { targetInfo } from "@/lib/moderation";
import { isReportTarget } from "@/lib/reports";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Admin afgør en anmeldelse: { action: "remove" | "reject", decision }.
 * Sælgeren får begrundelsen på mail, når noget bliver fjernet. Den, der anmeldte, får besked om afgørelsen.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; decision?: unknown };
  const action = body.action === "remove" || body.action === "reject" ? body.action : null;
  if (!action) return fail("Ukendt handling.", 400);
  const decision = typeof body.decision === "string" ? body.decision.trim().slice(0, 1000) : "";

  const { data: report } = await admin.from("reports").select("target_type,target_id").eq("id", id).maybeSingle();
  if (!report || !isReportTarget(report.target_type)) return fail("Anmeldelsen findes ikke.", 404);
  const info = await targetInfo(admin, report.target_type, report.target_id);
  // Alle åbne anmeldelser af det samme bliver afgjort på én gang, og alle, der anmeldte, får besked.
  const { data: open } = await admin
    .from("reports")
    .select("id,reporter_email")
    .eq("target_type", report.target_type)
    .eq("target_id", report.target_id)
    .eq("status", "open");
  const reporters = new Set(
    (open ?? []).map((r) => r.reporter_email).filter((e): e is string => Boolean(e)),
  );

  const { data, error } = await admin.rpc("admin_moderate", { p_report: id, p_action: action, p_decision: decision || null });
  if (error) return fail(error.message, 409);
  const res = (Array.isArray(data) ? data[0] : data) as { owner_id: string | null } | null;
  console.info("[snuplive] admin", user.email, "anmeldelse", action, id);
  // Det fjernede skal forsvinde fra forsiden, kategorierne og tingens egen side med det samme.
  if (action === "remove") revalidatePath("/", "layout");

  if (action === "remove" && res?.owner_id) {
    const { data: owner } = await admin.auth.admin.getUserById(res.owner_id).catch(() => ({ data: null }));
    const to = owner?.user?.email;
    if (to) {
      await sendMail({
        to: [to],
        replyTo: [COMPANY.email],
        subject: report.target_type === "profile" ? "Din sælgerkonto på Relived er lukket" : `Vi har fjernet ${info.label} fra Relived`,
        text: [
          "Hej",
          "",
          report.target_type === "profile"
            ? "Vi har lukket din sælgerkonto på Relived efter en anmeldelse. Dine kommende shows og ting er fjernet."
            : `Vi har fjernet ${info.label} fra Relived efter en anmeldelse.`,
          "",
          `Begrundelse: ${decision}`,
          "",
          "Ordrer, der allerede er betalt, bliver gjort færdige eller refunderet.",
          `Er du uenig, så svar på denne mail eller skriv til ${COMPANY.email}, så ser vi på det igen.`,
          "",
          "Hilsen Relived",
        ].join("\n"),
      });
    }
  }
  for (const to of reporters) {
    await sendMail({
      to: [to],
      replyTo: [COMPANY.email],
      subject: "Vi har afgjort din anmeldelse",
      text: [
        "Hej",
        "",
        `Tak, fordi du anmeldte ${info.label}.`,
        action === "remove"
          ? "Vi har kigget på det og fjernet det fra Relived."
          : "Vi har kigget på det og vurderet, at det ikke strider mod vores vilkår, så det bliver på siden.",
        `Er du uenig, kan du svare på denne mail eller skrive til ${COMPANY.email}.`,
        "",
        "Hilsen Relived",
      ].join("\n"),
    });
  }
  return json({ ok: true });
}
