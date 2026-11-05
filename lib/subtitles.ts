import { AgentDispatchClient } from "livekit-server-sdk";
import { livekitUrl, unquoteEnv } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Automatiske undertekster i live-shows. Et program hos LiveKit Cloud (agent/main.py) lytter på værtens og gæsternes
 * mikrofon og sender teksten til seerne. Siden sender programmet ind i showet, når showet går live, og kun hvis
 * kontakten i Backoffice → Indstillinger er slået til. Se README → "Automatiske undertekster".
 */

export const SUBTITLE_SETTING = "live_subtitles";
/** Samme navn som AGENT_NAME i agent/main.py. */
export const SUBTITLE_AGENT = "relived-undertekster";
/** Emnet på beskederne med teksten (samme som TOPIC i agent/main.py). */
export const SUBTITLE_TOPIC = "undertekst";

/** Mærker, der tit bliver sagt i shows. Talegenkendelsen får dem på forhånd, så de bliver stavet rigtigt. */
const BRANDS = [
  "Relived",
  "Ganni",
  "Samsøe Samsøe",
  "Mads Nørgaard",
  "Wood Wood",
  "Stine Goya",
  "By Malene Birger",
  "Acne Studios",
  "Filippa K",
  "Arket",
  "COS",
  "Levi's",
  "Louis Vuitton",
  "Gucci",
  "Chanel",
  "Hermès",
  "Prada",
  "Moncler",
  "Rolex",
  "Arne Jacobsen",
  "Hans J. Wegner",
  "Børge Mogensen",
  "Fritz Hansen",
  "Louis Poulsen",
  "Royal Copenhagen",
  "Georg Jensen",
  "Kähler",
  "Holmegaard",
  "Kay Bojesen",
  "Bing & Grøndahl",
  "Le Klint",
  "HAY",
  "Lego",
];

const TTL = 15_000;
let cache: { on: boolean; at: number } | null = null;

/** Er LiveKit sat op i Vercel? Uden det er der hverken video eller undertekster. */
function dispatchClient() {
  const url = livekitUrl(process.env.LIVEKIT_URL);
  const key = unquoteEnv(process.env.LIVEKIT_API_KEY);
  const secret = unquoteEnv(process.env.LIVEKIT_API_SECRET);
  if (!url || !key || !secret) return null;
  return new AgentDispatchClient(url.replace(/^ws/i, "http"), key, secret);
}

/** Er kontakten i Backoffice slået til (og LiveKit sat op)? Huskes 15 sekunder. Kan den ikke læses, er den slået fra. */
export async function subtitlesOn(): Promise<boolean> {
  if (!dispatchClient()) return false;
  if (cache && Date.now() - cache.at < TTL) return cache.on;
  let on = false;
  try {
    const sb = createPublicClient();
    if (sb) {
      const { data, error } = await sb.from("settings").select("value").eq("key", SUBTITLE_SETTING).maybeSingle();
      on = !error && data?.value === true;
    }
  } catch {
    on = false;
  }
  cache = { on, at: Date.now() };
  return on;
}

export function clearSubtitlesCache() {
  cache = null;
}

/** Ord til talegenkendelsen: først mærker, der står i varernes navne, så varernes navne, så resten af mærkerne. */
export function subtitleKeyterms(itemNames: string[]) {
  const names = itemNames.map((n) => n.replace(/\s+/g, " ").trim()).filter((n) => n.length >= 2 && n.length <= 40);
  const lower = names.join(" ").toLowerCase();
  const used = BRANDS.filter((b) => lower.includes(b.toLowerCase()));
  const out: string[] = [];
  for (const t of [...used, ...names.slice(0, 30), ...BRANDS]) {
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 50);
}

/**
 * Send programmet ind i showet (rummet hedder det samme som showets id). Er programmet der allerede (eller på vej), sker
 * der ikke mere. Er det gået ud igen (fx fordi kameraet var slukket i mere end 2 minutter), sendes et nyt ind.
 * Kommer to forespørgsler samtidig, bliver den nyeste fjernet igen.
 */
export async function startSubtitles(showId: string, keyterms: string[]) {
  const c = dispatchClient();
  if (!c) return false;
  const ours = async () => (await c.listDispatch(showId)).filter((d) => d.agentName === SUBTITLE_AGENT);
  // Et job er i gang, når det venter eller kører (JS_PENDING = 0, JS_RUNNING = 1). Uden job venter programmet på at starte.
  const alive = (d: Awaited<ReturnType<typeof ours>>[number]) => {
    const jobs = d.state?.jobs ?? [];
    return !jobs.length || jobs.some((j) => (j.state?.status ?? 0) <= 1);
  };
  const before = await ours();
  if (before.some(alive)) return true;
  for (const old of before) await c.deleteDispatch(old.id, showId).catch(() => undefined);
  await c.createDispatch(showId, SUBTITLE_AGENT, { metadata: JSON.stringify({ keyterms }) });
  const all = (await ours()).filter(alive).sort((a, b) => {
    const ta = a.state?.createdAt ?? BigInt(0);
    const tb = b.state?.createdAt ?? BigInt(0);
    return ta < tb ? -1 : ta > tb ? 1 : a.id.localeCompare(b.id);
  });
  for (const extra of all.slice(1)) await c.deleteDispatch(extra.id, showId).catch(() => undefined);
  return true;
}

/** Tag programmet ud af showet igen (sælgeren slår underteksterne fra, eller showet slutter). */
export async function stopSubtitles(showId: string) {
  const c = dispatchClient();
  if (!c) return;
  const list = await c.listDispatch(showId).catch(() => []);
  for (const d of list) {
    if (d.agentName === SUBTITLE_AGENT) await c.deleteDispatch(d.id, showId).catch(() => undefined);
  }
}
