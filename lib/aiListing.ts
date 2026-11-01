// "AI skriver annoncen": Claude ser billederne af varen og foreslår navn, størrelse, stand, kategori, beskrivelse og et
// prisleje. Det er kun forslag: sælgeren tjekker og retter, før varen bliver lagt op. Ingen imports, så den kan testes.

/** Standen, Claude vælger imellem (samme ord som i formularen). */
export const AI_CONDITIONS = ["Ny med prismærke", "Som ny", "God stand", "Brugt, med lidt slid", "Slidt"] as const;

const CATEGORY_KEYS = ["dametoej", "herretoej", "luksus", "skoenhed", "boernetoej", "bolig", "samlerting", "andet"] as const;

export interface AiListing {
  name: string;
  size: string | null;
  condition: string | null;
  category: string | null;
  description: string | null;
  priceLow: number | null;
  priceHigh: number | null;
  /** Det, sælgeren skal tjekke ekstra, fx "størrelse" og "mærke". */
  unsure: string[];
}

export function aiListingPrompt(hint?: string) {
  const known = hint ? ` Sælgeren har selv skrevet: "${hint.slice(0, 80).replace(/"/g, "'")}".` : "";
  return [
    "Du hjælper en sælger på Relived, en dansk markedsplads for brugt tøj og design, med at skrive en annonce ud fra billederne af én vare." + known,
    "Svar KUN med et JSON-objekt med disse felter:",
    '{"name": string, "brand": string|null, "size": string|null, "material": string|null, "condition": string, "category": string, "description": string, "price_low": number, "price_high": number, "unsure": string[]}',
    "Regler:",
    "- Skriv kun det, du kan se på billederne. Gæt aldrig mærke, størrelse eller materiale.",
    '- name: højst 60 tegn: hvad varen er og farven, fx "Uldfrakke, kamel". Kan mærket læses på et mærkat eller logo, så skriv det først, fx "Ganni strikkjole, grøn".',
    "- brand: mærket, kun hvis det kan læses på billederne, ellers null.",
    "- size: størrelsen, kun hvis den kan læses på et mærkat, ellers null.",
    "- material: fra vaskemærket, kun hvis det kan læses, ellers null.",
    `- condition: én af ${AI_CONDITIONS.map((c) => `"${c}"`).join(", ")}, ud fra det, du kan se.`,
    "- category: én af dametoej, herretoej, luksus (designertasker, ure og smykker fra luksusmærker), skoenhed (kun ny og uåbnet makeup, parfume og hudpleje), boernetoej, bolig (lamper, keramik, glas, møbler og design til hjemmet), samlerting (vinyl, LEGO, samlekort, retrospil) eller andet.",
    "- description: 2-4 korte, ærlige sætninger på dansk til køberen: mærke og materiale, hvis de kan læses, farve, stil og pasform, og synlige fejl eller slid. Ingen emojis og ingen overdrivelser. Skriv aldrig, at varen er ægte eller original.",
    "- price_low og price_high: et realistisk prisleje i hele kroner for varen brugt i Danmark ud fra type, mærke og stand. Er du usikker, så gør spændet bredt.",
    '- unsure: de ting, sælgeren skal tjekke ekstra, med korte danske ord, fx ["størrelse", "mærke", "fejl"]. Nævn altid "mål", da du ikke kan måle.',
    '- Viser billederne ikke en vare, der kan sælges, så svar {"error": "no_item"}.',
  ].join("\n");
}

const clean = (v: unknown, max: number) => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim().slice(0, max);
  return s && !/^(null|ukendt|unknown|-|n\/a)$/i.test(s) ? s : null;
};

const kroner = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 100_000 ? Math.round(n) : null;
};

/**
 * Læser Claudes svar. Giver forslaget, "no_item" (billederne viser ikke en vare) eller null (svaret kunne ikke læses).
 */
export function parseAiListing(text: string): AiListing | "no_item" | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (j.error === "no_item") return "no_item";
  const name = clean(j.name, 80);
  if (!name || name.length < 2) return null;

  const brand = clean(j.brand, 40);
  const material = clean(j.material, 60);
  const size = clean(j.size, 20);
  const cond = clean(j.condition, 40);
  const condition = AI_CONDITIONS.find((c) => c.toLowerCase() === cond?.toLowerCase()) ?? null;
  const catRaw = clean(j.category, 20)?.toLowerCase() ?? null;
  const category = (CATEGORY_KEYS as readonly string[]).includes(catRaw ?? "") ? catRaw : null;

  // Mærke og materiale står i beskrivelsen (formularen har ikke egne felter til dem).
  let description = clean(j.description, 900);
  const extra = [
    brand && !(description ?? "").toLowerCase().includes(brand.toLowerCase()) ? `Mærke: ${brand}.` : "",
    material && !(description ?? "").toLowerCase().includes(material.toLowerCase()) ? `Materiale: ${material}.` : "",
  ].filter(Boolean);
  if (extra.length) description = [description, ...extra].filter(Boolean).join(" ");
  // Claude må ikke love ægthed. Det klarer ægthedstjekket.
  if (description) description = description.replace(/[^.!?]*(?<!\p{L})(ægte|original|autentisk)(?!\p{L})[^.!?]*[.!?]?/giu, " ").replace(/\s+/g, " ").trim() || null;

  let lo = kroner(j.price_low);
  let hi = kroner(j.price_high);
  if (lo && hi && lo > hi) [lo, hi] = [hi, lo];
  if (lo && !hi) hi = lo;
  if (hi && !lo) lo = hi;

  const unsure = Array.isArray(j.unsure)
    ? [...new Set(j.unsure.map((u) => clean(u, 24)?.toLowerCase()).filter((u): u is string => Boolean(u)))].slice(0, 6)
    : [];
  if (!unsure.includes("mål")) unsure.push("mål");
  if (!size && !unsure.includes("størrelse") && category !== "bolig" && category !== "samlerting") unsure.unshift("størrelse");

  return { name: name.slice(0, 80), size, condition, category, description, priceLow: lo, priceHigh: hi, unsure };
}

/** Et pænt tal midt i prislejet, fx 350 for 300-400. */
export function suggestedPrice(l: Pick<AiListing, "priceLow" | "priceHigh">) {
  if (!l.priceLow || !l.priceHigh) return null;
  const mid = (l.priceLow + l.priceHigh) / 2;
  const step = mid >= 1000 ? 50 : mid >= 200 ? 25 : mid >= 50 ? 5 : 1;
  return Math.max(1, Math.round(mid / step) * step);
}
