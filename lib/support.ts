import { createHash } from "node:crypto";
import { COMPANY } from "@/lib/company";
import { SITE_URL } from "@/lib/env";
import { adminEmails, sendMail } from "@/lib/mail";
import type { AdminClient } from "@/lib/supabase/admin";
import { deviceLabel, SUPPORT_THREAD_COLS, type SupportMessage, type SupportThreadRow } from "@/lib/support-shared";

// Supportchatten på serveren: cookie, spamstempel og mails. Kun serveren læser og skriver tabellerne.

export const SUPPORT_COOKIE = "snup_support";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function supportCookie(token: string, secure: boolean) {
  return { name: SUPPORT_COOKIE, value: token, httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 180 * 86400 };
}

/** Fingeraftryk af IP-adressen mod spam (ikke selve adressen). Skifter hver dag og slettes efter to døgn. */
export function ipHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`snuplive:support:${day}:${ip}`).digest("hex");
}

/** Den del af adressen, brugeren var på (uden ?…, så der ikke kommer nøgler med). */
export function cleanPage(raw: unknown) {
  if (typeof raw !== "string" || !raw.startsWith("/")) return null;
  return raw.split(/[?#]/)[0].slice(0, 300);
}

const quote = (body: string) => body.split("\n").map((l) => `> ${l}`).join("\n");

/** Mail til admins om en ny besked. */
export async function mailAdminsAboutSupport(t: { id: string; email: string | null; name: string | null; page: string | null; user_agent: string | null }, body: string, isNew: boolean) {
  const who = t.name ? `${t.name} (${t.email ?? "ingen e-mail"})` : (t.email ?? "En besøgende");
  const where = [t.page ? `Side: ${t.page}` : null, deviceLabel(t.user_agent) ? `Enhed: ${deviceLabel(t.user_agent)}` : null].filter(Boolean).join("\n");
  return sendMail({
    to: adminEmails(),
    subject: `${isNew ? "Ny samtale" : "Ny besked"} i supporten: ${body.replace(/\s+/g, " ").slice(0, 60)}`,
    text: [
      `${who} skriver:`,
      "",
      quote(body),
      "",
      where,
      "",
      `Svar i Backoffice: ${SITE_URL}/admin/support/${t.id}`,
    ].join("\n"),
  });
}

/** Mail til brugeren med svarene fra SnupLive, de ikke har set. */
async function mailUser(admin: AdminClient, n: { id: string; token: string; email: string; since: string }) {
  const { data } = await admin
    .from("support_messages")
    .select("author_name,body,created_at")
    .eq("thread_id", n.id)
    .eq("sender", "admin")
    .gt("created_at", n.since)
    .order("id")
    .limit(20);
  const msgs = (data ?? []) as Pick<SupportMessage, "author_name" | "body">[];
  if (!msgs.length) return false;
  return sendMail({
    to: [n.email],
    replyTo: [COMPANY.email],
    subject: "Du har fået svar fra SnupLive",
    text: [
      "Hej,",
      "",
      "Du har fået svar på din besked til SnupLive:",
      "",
      ...msgs.flatMap((m) => [`${m.author_name || "SnupLive"} skriver:`, quote(m.body), ""]),
      `Fortsæt samtalen her: ${SITE_URL}/?hjaelp=${n.token}`,
      "",
      "Du kan også bare svare på denne mail.",
      "",
      "Venlig hilsen",
      "SnupLive",
      COMPANY.email,
    ].join("\n"),
  });
}

/** Mail med det samme efter et svar, hvis brugeren ikke har chatten åben. */
export async function notifyUserNow(admin: AdminClient, threadId: string) {
  const { data } = await admin.rpc("support_user_notices", { p_thread: threadId });
  let sent = false;
  for (const n of (data ?? []) as { id: string; token: string; email: string; since: string }[]) sent = (await mailUser(admin, n)) || sent;
  return sent;
}

let lastSweep = 0;
/**
 * Svar, som brugeren ikke nåede at se, før de lukkede chatten, kommer på mail efter 2 minutter.
 * Kaldes, mens nogen bruger chatten eller Backoffice, og af det daglige job. Højst hvert 30. sekund.
 */
export async function sweepSupportNotices(admin: AdminClient, force = false) {
  if (!force && Date.now() - lastSweep < 30_000) return 0;
  lastSweep = Date.now();
  const { data, error } = await admin.rpc("support_user_notices", { p_thread: null });
  if (error) return 0;
  let n = 0;
  for (const row of (data ?? []) as { id: string; token: string; email: string; since: string }[]) if (await mailUser(admin, row)) n++;
  return n;
}

/** Navnet, brugeren ser ved svar fra os: fornavnet fra profilen (Min konto → Navn), ellers bare "SnupLive". */
export function staffName(p: { display_name: string | null; handle: string } | null) {
  const first = p?.display_name?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 60) : null;
}

export type SupportFilter = "open" | "closed" | "all";
export const isSupportFilter = (v: unknown): v is SupportFilter => v === "open" || v === "closed" || v === "all";

/** Samtalerne til Backoffice: ulæste og nyeste først. */
export async function listSupportThreads(admin: AdminClient, filter: SupportFilter) {
  let q = admin.from("support_threads").select(SUPPORT_THREAD_COLS).order("admin_unread", { ascending: false }).order("last_message_at", { ascending: false }).limit(100);
  if (filter !== "all") q = q.eq("status", filter);
  const [rows, open, unread] = await Promise.all([
    q,
    admin.from("support_threads").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("support_threads").select("id", { count: "exact", head: true }).eq("admin_unread", true),
  ]);
  return {
    threads: (rows.data ?? []) as unknown as SupportThreadRow[],
    open: open.count ?? 0,
    unread: unread.count ?? 0,
  };
}
