import { fail, json } from "@/lib/api";
import { COMPANY } from "@/lib/company";
import { isAdminEmail, mailProblem, sendMail, sendMailBatch } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";
import { unsubFooter, unsubHeaders } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

/** Mail til ventelisten: { subject, text, to: "all" | "sellers", test }. Test går kun til admin selv. */
export async function POST(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user?.email || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const body = (await req.json().catch(() => ({}))) as { subject?: unknown; text?: unknown; to?: unknown; test?: unknown };
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 150) : "";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 5000) : "";
  if (!subject || !text) return fail("Skriv både emne og tekst.", 400);

  if (body.test === true) {
    const ok = await sendMail({ to: [user.email], subject: `[Test] ${subject}`, text: text + unsubFooter("00000000-0000-0000-0000-000000000000"), replyTo: [COMPANY.email], headers: unsubHeaders("00000000-0000-0000-0000-000000000000") });
    return ok ? json({ ok: true, sent: 1 }) : fail(mailProblem(), 502);
  }

  let q = admin.from("waitlist").select("email,unsub_token").not("confirmed_at", "is", null).is("unsubscribed_at", null);
  if (body.to === "sellers") q = q.in("role", ["seller", "both"]);
  const { data, error } = await q.limit(50_000);
  if (error) return fail(error.message, 500);
  const msgs = (data ?? []).map((r) => ({
    to: r.email as string,
    subject,
    text: text + unsubFooter(r.unsub_token as string),
    replyTo: [COMPANY.email],
    headers: unsubHeaders(r.unsub_token as string),
  }));
  if (!msgs.length) return fail("Der er ingen at sende til.", 400);
  const sent = await sendMailBatch(msgs);
  console.info("[snuplive] admin", user.email, "mail til ventelisten", { to: body.to, sent, total: msgs.length });
  if (!sent) return fail(mailProblem(), 502);
  return json({ ok: true, sent });
}
