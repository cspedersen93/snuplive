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

let lastError = "";

const FROM_DEFAULT = "Relived <noreply@relived.dk>";

/**
 * Afsenderen fra MAIL_FROM, renset for små tastefejl i Vercel: anførselstegn og `backticks` omkring,
 * eller kun en e-mail uden navn. Resend kræver formen "Navn <mail@domæne.dk>".
 */
export function mailFrom() {
  const raw = unquoteEnv(process.env.MAIL_FROM)
    .replace(/^MAIL_FROM\s*=\s*/i, "")
    .replace(/^[`'"\s]+|[`'"\s]+$/g, "");
  if (!raw) return FROM_DEFAULT;
  const email = /[^\s<>"'`]+@[^\s<>"'`]+\.[a-z]{2,}/i.exec(raw)?.[0];
  if (!email) return FROM_DEFAULT;
  const name = raw.replace(email, "").replace(/[<>"'`]/g, "").trim();
  return `${name || "Relived"} <${email}>`;
}

/**
 * Hvorfor den sidste mail ikke blev sendt, forklaret, så admins kan rette det selv
 * (fx at domænet ikke er bekræftet hos Resend endnu, eller at nøglen ikke må sende fra det).
 */
function resendMessage() {
  try {
    const j = JSON.parse(lastError) as { message?: string; name?: string };
    return [j.message, j.name ? `(${j.name})` : ""].filter(Boolean).join(" ") || lastError;
  } catch {
    return lastError;
  }
}

export function mailProblem() {
  const from = mailFrom();
  const domain = /@([^>\s]+)/.exec(from)?.[1] ?? "domænet";
  if (!unquoteEnv(process.env.RESEND_API_KEY)) return "RESEND_API_KEY mangler i Vercel.";
  if (/`from` field|from field/i.test(lastError)) {
    return `MAIL_FROM i Vercel har en forkert form. Skriv den sådan: Relived <kontakt@${domain}> (uden anførselstegn), og lav en Redeploy.`;
  }
  if (/not verified|verify/i.test(lastError)) {
    return `${domain} er ikke bekræftet hos Resend endnu. Vent, til der står Verified under Domains hos Resend, eller sæt MAIL_FROM i Vercel tilbage til et bekræftet domæne så længe.`;
  }
  if (/restricted|not allowed|not authori[sz]ed|permission|access/i.test(lastError)) {
    return `Resend-nøglen må ikke sende fra ${domain}. Lav en nøgle med adgang til ${domain} (eller alle domæner) hos Resend, og læg den i RESEND_API_KEY i Vercel. (Resend: ${resendMessage()})`;
  }
  if (/api key|unauthori[sz]ed|invalid/i.test(lastError)) {
    return `Resend afviser nøglen. Tjek RESEND_API_KEY i Vercel, og lav en Redeploy, når du har ændret den. (Resend: ${resendMessage()})`;
  }
  return lastError ? `Resend svarede: ${resendMessage()}` : "Mailen blev ikke sendt. Tjek RESEND_API_KEY og MAIL_FROM i Vercel.";
}

export async function sendMail(msg: { to: string[]; subject: string; text: string; replyTo?: string[]; headers?: Record<string, string> }) {
  const key = unquoteEnv(process.env.RESEND_API_KEY);
  const to = msg.to.filter(Boolean);
  if (!key || !to.length) return false;
  const base = (unquoteEnv(process.env.RESEND_API_BASE) || "https://api.resend.com").replace(/\/+$/, "");
  const from = mailFrom();
  try {
    const r = await fetch(`${base}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.replyTo?.length ? { reply_to: msg.replyTo } : {}),
        ...(msg.headers ? { headers: msg.headers } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      const body = (await r.text()).slice(0, 300);
      lastError = body;
      console.error("[snuplive] mail fejlede", r.status, body);
    }
    return r.ok;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.error("[snuplive] mail fejlede", e);
    return false;
  }
}

/** Mange mails på én gang (Resend tager op til 100 pr. kald). */
export async function sendMailBatch(msgs: { to: string; subject: string; text: string; replyTo?: string[]; headers?: Record<string, string> }[]) {
  const key = unquoteEnv(process.env.RESEND_API_KEY);
  if (!key || !msgs.length) return 0;
  const base = (unquoteEnv(process.env.RESEND_API_BASE) || "https://api.resend.com").replace(/\/+$/, "");
  const from = mailFrom();
  let sent = 0;
  for (let i = 0; i < msgs.length; i += 100) {
    const chunk = msgs.slice(i, i + 100).map((m) => ({
      from,
      to: [m.to],
      subject: m.subject,
      text: m.text,
      ...(m.replyTo?.length ? { reply_to: m.replyTo } : {}),
      ...(m.headers ? { headers: m.headers } : {}),
    }));
    try {
      const r = await fetch(`${base}/emails/batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(15_000),
      });
      if (r.ok) sent += chunk.length;
      else {
        lastError = (await r.text()).slice(0, 300);
        console.error("[snuplive] mails fejlede", r.status, lastError);
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error("[snuplive] mails fejlede", e);
    }
  }
  return sent;
}
