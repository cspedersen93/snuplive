import { notFound, redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

/**
 * Kun for admins (e-mails i ADMIN_EMAILS). Ikke logget ind → login. Ikke admin → "Siden findes ikke".
 * Kaldes i hver admin-side, så siderne er beskyttet hver for sig.
 */
export async function requireAdmin(next = "/admin") {
  const user = await getUserInfo(await createClient());
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isAdminEmail(user.email)) notFound();
  return { user, admin: createAdminClient() };
}

export const PERIODS = [
  { key: "7", label: "7 dage", days: 7 },
  { key: "30", label: "30 dage", days: 30 },
  { key: "90", label: "90 dage", days: 90 },
  { key: "aar", label: "I år", days: 0 },
  { key: "alt", label: "Altid", days: -1 },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

/** Starten af perioden (dansk midnat for "i år"). */
export function periodStart(key: string | undefined): { key: PeriodKey; from: Date; label: string } {
  const p = PERIODS.find((x) => x.key === key) ?? PERIODS[1];
  const now = new Date();
  let from: Date;
  if (p.days > 0) {
    from = new Date(now.getTime() - (p.days - 1) * 864e5);
    from.setUTCHours(0, 0, 0, 0);
  } else if (p.days === 0) from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  else from = new Date(Date.UTC(2026, 0, 1));
  return { key: p.key, from, label: p.label };
}

const nf = new Intl.NumberFormat("da-DK");
export const num = (n: number | string | null | undefined) => nf.format(Number(n ?? 0));
