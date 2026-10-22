import { SITE_URL } from "@/lib/env";
import { sendMail } from "@/lib/mail";

export type WaitlistRole = "buyer" | "seller" | "both";
export const WAITLIST_ROLES: Record<WaitlistRole, string> = { buyer: "Køber", seller: "Sælger", both: "Begge dele" };
export const isWaitlistRole = (v: unknown): v is WaitlistRole => typeof v === "string" && v in WAITLIST_ROLES;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isToken = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export const unsubscribeUrl = (token: string) => `${SITE_URL}/kommer-snart/afmeld?t=${token}`;

/** Mailen med linket, man trykker på for at bekræfte sin tilmelding. */
export function sendConfirmMail(email: string, token: string) {
  return sendMail({
    to: [email],
    subject: "Bekræft din tilmelding til SnupLive",
    text: [
      "Hej",
      "",
      "Tak, fordi du vil være med, når SnupLive åbner.",
      "Tryk på linket for at bekræfte din tilmelding:",
      `${SITE_URL}/kommer-snart/bekraeft?t=${token}`,
      "",
      "Har du ikke skrevet dig op, kan du bare slette mailen.",
      "",
      "Hilsen SnupLive",
    ].join("\n"),
  });
}

/**
 * Afmelding med ét klik i mailprogrammet (Gmail og Yahoo kræver det af nyhedsmails).
 * Mailprogrammet sender en POST til linket med "List-Unsubscribe=One-Click".
 */
export function unsubHeaders(token: string) {
  return {
    "List-Unsubscribe": `<${SITE_URL}/api/venteliste/afmeld?t=${token}>, <mailto:kontakt@snuplive.dk?subject=Afmeld>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Nederst i alle mails til ventelisten: link til afmelding. */
export function unsubFooter(token: string) {
  return `\n\n—\nDu får mailen, fordi du har skrevet dig op til SnupLive.\nAfmeld: ${unsubscribeUrl(token)}`;
}
