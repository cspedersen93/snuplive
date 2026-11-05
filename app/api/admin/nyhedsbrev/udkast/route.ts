import { fail, json } from "@/lib/api";
import { campaignFlags } from "@/lib/campaignFlags";
import { GREEN_FRIDAY, JULEKALENDER, campaignState } from "@/lib/campaigns";
import { aiConfigured, askClaude, rateLimiter } from "@/lib/claude";
import { SITE_URL, unquoteEnv } from "@/lib/env";
import { clock, dayLabel } from "@/lib/format";
import { isAdminEmail } from "@/lib/mail";
import { isDraftLength, newsletterPrompt, parseNewsletterDraft, type NewsletterDraft } from "@/lib/newsletterAi";
import { fetchListing } from "@/lib/queries";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Claude bruger typisk 5-15 sekunder på et udkast.
export const maxDuration = 60;

const tooMany = rateLimiter(20, 10 * 60_000);
// Skrivningen bruger en stærkere model end billedvalget. Kan ændres med ANTHROPIC_WRITER_MODEL i Vercel.
const WRITER_MODEL = "claude-sonnet-5-5";

/**
 * "Skriv med Claude": { brief, length: "kort" | "mellem" | "lang", current?: { subject, text } }.
 * Med current retter Claude det nuværende udkast efter stikordene i stedet for at skrive et nyt. Kun admins.
 */
export async function POST(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user?.email || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  if (!aiConfigured()) return fail("Claude er ikke sat op. Læg ANTHROPIC_API_KEY ind i Vercel, og tryk Redeploy.", 503);
  if (tooMany(user.email)) return fail("Du har bedt om mange udkast på kort tid. Vent et par minutter.", 429);

  const body = (await req.json().catch(() => ({}))) as { brief?: unknown; length?: unknown; current?: unknown };
  const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, 1500) : "";
  if (brief.length < 3) return fail("Skriv et par ord om, hvad nyhedsbrevet skal handle om.", 400);
  const length = isDraftLength(body.length) ? body.length : "mellem";
  const c = body.current as Partial<NewsletterDraft> | undefined;
  const current =
    c && typeof c.subject === "string" && typeof c.text === "string" && c.text.trim()
      ? { subject: c.subject.slice(0, 150), text: c.text.slice(0, 5000) }
      : null;

  // Det Claude må skrive om: dagens dato, kampagnerne, der er slået til, og de næste offentlige shows.
  const now = new Date();
  const [flags, listing] = await Promise.all([campaignFlags(), fetchListing(0, 10)]);
  const { gf, jk } = campaignState(now, flags);
  const campaigns: string[] = [];
  if (gf.phase !== "over") {
    campaigns.push(
      `Green Friday: et stort live-show ${GREEN_FRIDAY.label} kl. ${GREEN_FRIDAY.hour} med alle vores stiftende sælgere efter hinanden. Gode fund og budsalg i stedet for nye varer.${gf.phase === "today" ? " Det er i aften." : ""} Læs mere: ${SITE_URL}/nyhedsbrev#green-friday`,
    );
  }
  if (jk.phase !== "over") {
    campaigns.push(
      `Julekalenderen: et live-show hver aften kl. ${JULEKALENDER.hour} fra 1. til 24. december med én særlig vare på budsalg fra 1 kr.${jk.phase === "running" ? ` Låge ${jk.door} åbner ${jk.tonight ? "i aften" : "i morgen"}.` : ""} Læs mere: ${SITE_URL}/nyhedsbrev#julekalender`,
    );
  }
  const soon = Date.now() + 14 * 864e5;
  const shows = listing.upcoming
    .filter((s) => s.starts_at && Date.parse(s.starts_at) < soon && s.seller?.handle)
    .slice(0, 8)
    .map((s) => ({
      when: `${dayLabel(s.starts_at as string)} kl. ${clock(s.starts_at as string)}`,
      title: s.title,
      seller: s.seller?.handle as string,
      url: `${SITE_URL}/live/${s.seller?.handle}`,
    }));
  const today = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);

  const prompt = newsletterPrompt(brief, length, { today, site: SITE_URL, campaigns, shows }, current);
  const model = unquoteEnv(process.env.ANTHROPIC_WRITER_MODEL) || WRITER_MODEL;
  const answer = await askClaude([], prompt, { model, maxTokens: 2000, label: "nyhedsbrevet", timeoutMs: 50_000 });
  if (!("text" in answer)) return fail("Claude svarede ikke. Prøv igen om lidt.", 502);
  const draft = parseNewsletterDraft(answer.text);
  if (!draft) return fail("Claudes svar kunne ikke læses. Prøv igen.", 502);
  console.info("[relived] admin", user.email, "fik et udkast til nyhedsbrevet af Claude", { length, ret: Boolean(current) });
  return json(draft);
}
