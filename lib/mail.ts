import { unquoteEnv } from "@/lib/env";

// E-mails fra appen (fx når en køber melder et problem) sendes via Resend, hvis RESEND_API_KEY er sat.

/** Admins: e-mails i ADMIN_EMAILS (adskilt med komma). De kan se /admin og får besked om nye sager. */
export function adminEmails() {
  return unquoteEnv(process.env.ADMIN_EMAILS)
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

export const isAdminEmail = (email: string | null | undefined) => Boolean(email && adminEmails().includes(email.toLowerCase()));

export async function sendMail(msg: { to: string[]; subject: string; text: string; replyTo?: string[] }) {
  const key = unquoteEnv(process.env.RESEND_API_KEY);
  const to = msg.to.filter(Boolean);
  if (!key || !to.length) return false;
  const base = (unquoteEnv(process.env.RESEND_API_BASE) || "https://api.resend.com").replace(/\/+$/, "");
  const from = unquoteEnv(process.env.MAIL_FROM) || "SnupLive <noreply@snuplive.dk>";
  try {
    const r = await fetch(`${base}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: msg.subject, text: msg.text, ...(msg.replyTo?.length ? { reply_to: msg.replyTo } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.error("[snuplive] mail fejlede", r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) {
    console.error("[snuplive] mail fejlede", e);
    return false;
  }
}
