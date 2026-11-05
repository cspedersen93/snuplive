/**
 * Kampagner på forsiden, på /nyhedsbrev og i bekræftelsesmailen: Green Friday og julekalenderen.
 * Datoerne står her ét sted. Kortene forsvinder af sig selv, når kampagnen er slut (dansk tid).
 * Hver kampagne skal også være slået til i Backoffice → Nyhedsbrev (se lib/campaignFlags.ts).
 */

/** Indstillingerne i Backoffice → Nyhedsbrev. Alle er slået fra, til de bliver slået til. */
export const CAMPAIGN_SETTINGS = {
  home: "newsletter_home",
  gf: "campaign_green_friday",
  jk: "campaign_julekalender",
} as const;
export type CampaignFlags = { home: boolean; gf: boolean; jk: boolean };
const ALL_ON: CampaignFlags = { home: true, gf: true, jk: true };

const TZ = "Europe/Copenhagen";

export const GREEN_FRIDAY = { date: "2026-11-27", hour: 20, label: "fredag 27. november" } as const;
export const JULEKALENDER = { start: "2026-12-01", end: "2026-12-24", hour: 20 } as const;
/** Efter dette klokkeslæt regner vi aftenens show for overstået. */
const SHOW_OVER_HOUR = 22;

type Before = { phase: "before"; days: number };
export type GreenFridayState = Before | { phase: "today" } | { phase: "over" };
export type JulekalenderState = Before | { phase: "running"; door: number; tonight: boolean } | { phase: "over" };

/** Dato (YYYY-MM-DD) og time i dansk tid. */
function cph(now: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

export function campaignState(now: Date = new Date(), flags: CampaignFlags = ALL_ON) {
  const { day, hour } = cph(now);

  let gf: GreenFridayState;
  if (!flags.gf) gf = { phase: "over" };
  else if (day < GREEN_FRIDAY.date) gf = { phase: "before", days: daysBetween(day, GREEN_FRIDAY.date) };
  else if (day === GREEN_FRIDAY.date && hour < SHOW_OVER_HOUR) gf = { phase: "today" };
  else gf = { phase: "over" };

  let jk: JulekalenderState;
  if (!flags.jk) jk = { phase: "over" };
  else if (day < JULEKALENDER.start) jk = { phase: "before", days: daysBetween(day, JULEKALENDER.start) };
  else if (day <= JULEKALENDER.end) {
    const door = Number(day.slice(8));
    if (hour < SHOW_OVER_HOUR) jk = { phase: "running", door, tonight: true };
    else if (door < 24) jk = { phase: "running", door: door + 1, tonight: false };
    else jk = { phase: "over" };
  } else jk = { phase: "over" };

  return { gf, jk, active: gf.phase !== "over" || jk.phase !== "over" };
}

/** "i morgen", "om 3 dage". */
export const inDays = (n: number) => (n <= 1 ? "i morgen" : `om ${n} dage`);

/** Linjer til bekræftelsesmailen, så den kun nævner det, der ikke er overstået. */
export function campaignMailLines(now: Date = new Date(), flags: CampaignFlags = ALL_ON) {
  const { gf, jk } = campaignState(now, flags);
  const lines: string[] = [];
  if (gf.phase !== "over") lines.push(`- Green Friday: et stort live-show ${GREEN_FRIDAY.label} kl. ${GREEN_FRIDAY.hour}`);
  if (jk.phase !== "over") lines.push(`- Julekalenderen: et live-show hver aften kl. ${JULEKALENDER.hour} fra 1. til 24. december`);
  lines.push("- Ugens shows og de bedste fund");
  return lines;
}
