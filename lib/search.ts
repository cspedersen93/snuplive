import { CATEGORIES, categoryBySlug } from "@/lib/format";

// Søgningen (/soeg) og søgeagenterne: læser og skriver søgningen i adressen, fx
// /soeg?q=uldfrakke&kategori=dametoej&fra=100&maks=500&str=M&stand=god&hvornaar=live&type=budsalg&aegthed=1&video=1&saelger=privat&sorter=billigst
// Filtrene (0033_filtre.sql) gemmes i databasen som ét felt: { min, stand, hvornaar, type, aegthed, video, saelger }.

export type Cond = "ny" | "somny" | "god" | "brugt";
export type When = "nu" | "live" | "snart";
export type BuyType = "fast" | "budsalg";
export type SellerKind = "privat" | "erhverv";
export type Sort = "anbefalet" | "nyeste" | "billigst" | "dyrest" | "snart";

export interface SearchFilters {
  min: number | null;
  stand: Cond | null;
  hvornaar: When | null;
  type: BuyType | null;
  aegthed: boolean;
  video: boolean;
  saelger: SellerKind | null;
}

export interface Search extends SearchFilters {
  q: string;
  /** Kategoriens nøgle (fx "bolig"), ikke slug. */
  category: string | null;
  maxPrice: number | null;
  size: string | null;
  sort: Sort;
  page: number;
}

export const CONDS: { key: Cond; label: string; short: string }[] = [
  { key: "ny", label: "Ny", short: "ny" },
  { key: "somny", label: "Som ny eller bedre", short: "som ny eller bedre" },
  { key: "god", label: "God stand eller bedre", short: "god stand eller bedre" },
  { key: "brugt", label: "Brugt eller bedre (ikke slidt)", short: "ikke slidt" },
];
export const WHENS: { key: When; label: string }[] = [
  { key: "nu", label: "Til salg nu" },
  { key: "live", label: "Live nu" },
  { key: "snart", label: "Kommer snart" },
];
export const TYPES: { key: BuyType; label: string }[] = [
  { key: "fast", label: "Køb nu (fast pris)" },
  { key: "budsalg", label: "Budsalg" },
];
export const SELLERS: { key: SellerKind; label: string }[] = [
  { key: "privat", label: "Privat sælger" },
  { key: "erhverv", label: "Virksomhed" },
];
export const SORTS: { key: Sort; label: string }[] = [
  { key: "anbefalet", label: "Anbefalet" },
  { key: "nyeste", label: "Nyeste" },
  { key: "billigst", label: "Billigste" },
  { key: "dyrest", label: "Dyreste" },
  { key: "snart", label: "Live og snart live" },
];

/** Kategorier, hvor størrelsesfeltet giver mening (og "Alle"). */
export const SIZE_CATEGORIES = ["dametoej", "herretoej", "boernetoej"];
export const hasSizeFilter = (category: string | null) => !category || SIZE_CATEGORIES.includes(category);

type Params = {
  q?: string;
  kategori?: string;
  fra?: string;
  maks?: string;
  str?: string;
  stand?: string;
  hvornaar?: string;
  type?: string;
  aegthed?: string;
  video?: string;
  saelger?: string;
  sorter?: string;
  side?: string;
};

const pick = <T extends string>(list: { key: T }[], v: string | undefined | null): T | null =>
  (list.find((x) => x.key === v)?.key ?? null) as T | null;

function price(v: string | undefined) {
  const n = Number((v ?? "").replace(/[^\d]/g, ""));
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : null;
}

export function parseSearch(sp: Params): Search {
  let q = (sp.q ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  let size = (sp.str ?? "").trim().slice(0, 20) || null;
  // "kjole str. M" → søg på "kjole" i størrelse M.
  const m = /(?:^|\s)(?:str\.?|størrelse)\s*([0-9]{1,3}(?:[-/][0-9]{1,3})?|xxs|xs|s|m|l|xl|xxl|xxxl)(?=\s|$)/i.exec(q);
  if (m && !size) {
    size = m[1].toUpperCase();
    q = (q.slice(0, m.index) + " " + q.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
  }
  const cat = sp.kategori ? categoryBySlug(sp.kategori) : null;
  const category = cat?.key ?? null;
  // Størrelsen gælder kun tøj og sko. Skifter man til fx Bolig, bliver den glemt.
  if (!hasSizeFilter(category)) size = null;
  let min = price(sp.fra);
  let max = price(sp.maks);
  if (min && max && min > max) [min, max] = [max, min];
  const page = Math.max(1, Math.min(50, Number(sp.side) || 1));
  return {
    q,
    category,
    maxPrice: max,
    size,
    min,
    stand: pick(CONDS, sp.stand),
    hvornaar: pick(WHENS, sp.hvornaar),
    type: pick(TYPES, sp.type),
    aegthed: sp.aegthed === "1",
    video: sp.video === "1",
    saelger: pick(SELLERS, sp.saelger),
    sort: pick(SORTS, sp.sorter) ?? "anbefalet",
    page,
  };
}

/** Filtrene, som databasen skal have dem (kun dem, der er valgt). */
export function filtersJson(s: Partial<SearchFilters>) {
  const f: Record<string, string | number | boolean> = {};
  if (s.min) f.min = s.min;
  if (s.stand) f.stand = s.stand;
  if (s.hvornaar) f.hvornaar = s.hvornaar;
  if (s.type) f.type = s.type;
  if (s.aegthed) f.aegthed = true;
  if (s.video) f.video = true;
  if (s.saelger) f.saelger = s.saelger;
  return f;
}

/** Filtrene fra en gemt søgeagent (feltet filters i databasen). */
export function filtersFrom(raw: unknown): SearchFilters {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = typeof r.min === "number" && r.min >= 1 ? Math.floor(r.min) : null;
  return {
    min: n,
    stand: pick(CONDS, typeof r.stand === "string" ? r.stand : null),
    hvornaar: pick(WHENS, typeof r.hvornaar === "string" ? r.hvornaar : null),
    type: pick(TYPES, typeof r.type === "string" ? r.type : null),
    aegthed: r.aegthed === true,
    video: r.video === true,
    saelger: pick(SELLERS, typeof r.saelger === "string" ? r.saelger : null),
  };
}

/** Antal valgte filtre ud over søgeordet og kategorien (til knappen "Filtre" på mobilen). */
export function filterCount(s: Partial<Search>) {
  return [s.size, s.min, s.maxPrice, s.stand, s.hvornaar, s.type, s.aegthed, s.video, s.saelger, s.sort && s.sort !== "anbefalet"].filter(
    Boolean,
  ).length;
}

type HrefInput = Partial<Search> & Pick<Search, "q" | "category" | "maxPrice" | "size">;

export function searchHref(s: HrefInput, page = 1) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  const cat = CATEGORIES.find((c) => c.key === s.category);
  if (cat) p.set("kategori", cat.slug);
  if (s.min) p.set("fra", String(s.min));
  if (s.maxPrice) p.set("maks", String(s.maxPrice));
  if (s.size) p.set("str", s.size);
  if (s.stand) p.set("stand", s.stand);
  if (s.hvornaar) p.set("hvornaar", s.hvornaar);
  if (s.type) p.set("type", s.type);
  if (s.aegthed) p.set("aegthed", "1");
  if (s.video) p.set("video", "1");
  if (s.saelger) p.set("saelger", s.saelger);
  if (s.sort && s.sort !== "anbefalet") p.set("sorter", s.sort);
  if (page > 1) p.set("side", String(page));
  const qs = p.toString();
  return qs ? `/soeg?${qs}` : "/soeg";
}

const kr = (n: number) => `${n.toLocaleString("da-DK")} kr`;

/** "uldfrakke · Dametøj · str. M · 100–500 kr · god stand eller bedre · budsalg" */
export function searchLabel(s: {
  query?: string | null;
  q?: string | null;
  category: string | null;
  max_price?: number | null;
  maxPrice?: number | null;
  size: string | null;
  filters?: unknown;
} & Partial<SearchFilters>) {
  const q = s.q ?? s.query ?? "";
  const max = s.maxPrice ?? s.max_price ?? null;
  const f = s.filters !== undefined ? filtersFrom(s.filters) : (s as Partial<SearchFilters>);
  const cat = CATEGORIES.find((c) => c.key === s.category);
  const priceText = f.min && max ? `${kr(f.min)}–${kr(max)}` : f.min ? `mindst ${kr(f.min)}` : max ? `højst ${kr(max)}` : "";
  return [
    q ? `"${q}"` : "",
    cat?.label ?? "",
    s.size ? `str. ${s.size}` : "",
    priceText,
    f.stand ? CONDS.find((c) => c.key === f.stand)?.short ?? "" : "",
    f.hvornaar ? (WHENS.find((w) => w.key === f.hvornaar)?.label.toLowerCase() ?? "") : "",
    f.type === "budsalg" ? "budsalg" : f.type === "fast" ? "køb nu" : "",
    f.aegthed ? "ægthed tjekket" : "",
    f.video ? "med video" : "",
    f.saelger === "erhverv" ? "virksomheder" : f.saelger === "privat" ? "private sælgere" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Er der noget at søge på? Ord, en kategori, en pris eller et filter. Sorteringen alene tæller ikke. */
export const searchable = (s: Partial<Search> & Pick<Search, "q" | "category">) =>
  s.q.length >= 2 || Boolean(s.category) || Boolean(s.maxPrice) || Object.keys(filtersJson(s)).length > 0;
