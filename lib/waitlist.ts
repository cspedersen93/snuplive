import { campaignFlags } from "@/lib/campaignFlags";
import { campaignMailLines } from "@/lib/campaigns";
import { SITE_URL } from "@/lib/env";
import { sendMail } from "@/lib/mail";

export type WaitlistRole = "buyer" | "seller" | "both";
export const WAITLIST_ROLES: Record<WaitlistRole, string> = { buyer: "Køber", seller: "Sælger", both: "Begge dele" };
export const isWaitlistRole = (v: unknown): v is WaitlistRole => typeof v === "string" && v in WAITLIST_ROLES;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isToken = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export const unsubscribeUrl = (token: string) => `${SITE_URL}/kommer-snart/afmeld?t=${token}`;

/** Tilmeldt via nyhedsbrevet (forsiden eller /nyhedsbrev) i stedet for ventelisten før åbningen. */
export const isNewsletterSource = (source: string | null | undefined) => !!source && source.startsWith("nyhedsbrev");

/** Mailen med linket, man trykker på for at bekræfte sin tilmelding. */
export async function sendConfirmMail(email: string, token: string, source?: string | null) {
  if (isNewsletterSource(source)) {
    const flags = await campaignFlags();
    return sendMail({
      to: [email],
      subject: "Bekræft din tilmelding til nyhedsbrevet fra Relived",
      text: [
        "Hej",
        "",
        "Tak, fordi du vil have nyhedsbrevet fra Relived. Du får blandt andet besked om:",
        ...campaignMailLines(new Date(), flags),
        "",
        "Tryk på linket for at bekræfte din tilmelding:",
        `${SITE_URL}/kommer-snart/bekraeft?t=${token}`,
        "",
        "Har du ikke skrevet dig op, kan du bare slette mailen.",
        "",
        "Hilsen Relived",
      ].join("\n"),
    });
  }
  return sendMail({
    to: [email],
    subject: "Bekræft din tilmelding til Relived",
    text: [
      "Hej",
      "",
      "Tak, fordi du vil være med, når Relived åbner.",
      "Tryk på linket for at bekræfte din tilmelding:",
      `${SITE_URL}/kommer-snart/bekraeft?t=${token}`,
      "",
      "Har du ikke skrevet dig op, kan du bare slette mailen.",
      "",
      "Hilsen Relived",
    ].join("\n"),
  });
}

/**
 * Afmelding med ét klik i mailprogrammet (Gmail og Yahoo kræver det af nyhedsmails).
 * Mailprogrammet sender en POST til linket med "List-Unsubscribe=One-Click".
 */
export function unsubHeaders(token: string) {
  return {
    "List-Unsubscribe": `<${SITE_URL}/api/venteliste/afmeld?t=${token}>, <mailto:kontakt@relived.dk?subject=Afmeld>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Nederst i alle mails til ventelisten: link til afmelding. */
export function unsubFooter(token: string) {
  return `\n\n—\nDu får mailen, fordi du har skrevet dig op til nyheder fra Relived.\nAfmeld: ${unsubscribeUrl(token)}`;
}
