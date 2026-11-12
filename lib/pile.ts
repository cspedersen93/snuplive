// "Film bunken": sælgeren filmer sine varer i ét stræk, én vare ad gangen. Der tages stillbilleder af videoen med jævne
// mellemrum, og Claude deler dem i varer. Bagefter skriver "AI skriver annoncen" et forslag pr. vare.
// Ingen imports, så filen kan testes for sig selv.

/** Så lang må videoen højst være (sekunder). */
export const PILE_MAX_SECONDS = 180;
/** Så mange stillbilleder sendes højst til opdelingen. */
export const PILE_MAX_FRAMES = 60;
/** Så mange varer kan en bunke højst blive til (bremsen på "AI skriver annoncen" er 30 på 10 minutter). */
export const PILE_MAX_ITEMS = 24;

export interface PileSegment {
  /** Første og sidste stillbillede med varen (fra 0). */
  first: number;
  last: number;
  /** Det stillbillede, hvor varen ses bedst (fra 0). */
  best: number;
}

/** Tidspunkterne (sekunder) for stillbillederne: mindst 1,5 sekund imellem, og højst PILE_MAX_FRAMES i alt. */
export function pileTimes(duration: number): number[] {
  const d = Math.min(duration, PILE_MAX_SECONDS);
  if (!Number.isFinite(d) || d < 2) return [];
  const step = Math.max(1.5, d / PILE_MAX_FRAMES);
  const out: number[] = [];
  for (let t = Math.min(0.6, d / 4); t < d - 0.2 && out.length < PILE_MAX_FRAMES; t += step) out.push(Math.round(t * 100) / 100);
  return out;
}

export function pilePrompt(count: number, stepSeconds: number) {
  return [
    `De ${count} billeder er stillbilleder fra én video, taget med ca. ${stepSeconds.toFixed(1).replace(".", ",")} sekunders mellemrum, i rækkefølge.`,
    "I videoen viser en sælger sine brugte varer frem, én vare ad gangen. Del billederne i varer.",
    'Svar kun med JSON i denne form: {"items":[{"first":1,"last":4,"best":2}]}',
    "Regler:",
    "- first og last er numrene på det første og sidste billede, hvor den samme vare vises. best er det billede imellem dem, hvor varen ses tydeligst og fylder mest.",
    "- Varerne skal stå i den rækkefølge, de vises, og må ikke overlappe.",
    "- Spring billeder over, hvor der ikke vises en vare tydeligt: skift mellem varer, hænder, gulv, slørede billeder.",
    "- Er to billeder af den samme vare (samme type, farve og mønster), hører de sammen, også hvis den er vendt eller holdt anderledes.",
    "- Vises den samme vare igen senere i videoen, så tag den kun med første gang.",
    `- Højst ${PILE_MAX_ITEMS} varer. Vises der ingen varer, så svar {"items":[]}.`,
  ].join("\n");
}

/** Læser Claudes opdeling. Numrene i svaret tæller fra 1, resultatet fra 0. null: svaret kunne ikke læses. */
export function parsePile(text: string, count: number): PileSegment[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let j: { items?: unknown };
  try {
    j = JSON.parse(text.slice(start, end + 1)) as { items?: unknown };
  } catch {
    return null;
  }
  if (!Array.isArray(j.items)) return null;
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
  const out: PileSegment[] = [];
  let prev = 0;
  for (const raw of j.items) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    let first = int(r.first);
    let last = int(r.last);
    if (first === null || last === null) continue;
    if (first > last) [first, last] = [last, first];
    first = Math.max(first, prev + 1);
    last = Math.min(last, count);
    if (first > last) continue;
    const b = int(r.best);
    const best = b !== null && b >= first && b <= last ? b : Math.floor((first + last) / 2);
    out.push({ first: first - 1, last: last - 1, best: best - 1 });
    prev = last;
    if (out.length >= PILE_MAX_ITEMS) break;
  }
  return out;
}

/** Op til tre stillbilleder til annoncen: det bedste først, og så et tidligt og et sent fra samme vare. */
export function pileShots(s: PileSegment): number[] {
  const picks = [s.best];
  const len = s.last - s.first;
  if (len >= 2) {
    const early = s.first === s.best ? s.first + 1 : s.first;
    const late = s.last === s.best ? s.last - 1 : s.last;
    for (const i of [late, early]) if (!picks.includes(i) && picks.length < 3) picks.push(i);
  } else if (len === 1) {
    picks.push(s.best === s.first ? s.last : s.first);
  }
  return picks;
}
