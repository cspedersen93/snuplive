import { CATEGORIES, categoryBySlug } from "@/lib/format";

// Søgningen (/soeg) og søgeagenterne: læser og skriver søgningen i adressen, fx /soeg?q=uldfrakke&kategori=dametoej&maks=500&str=M.

export interface Search {
  q: string;
  /** Kategoriens nøgle (fx "bolig"), ikke slug. */
  category: string | null;
  maxPrice: number | null;
  size: string | null;
  page: number;
}

type Params = { q?: string; kategori?: string; maks?: string; str?: string; side?: string };

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
  const maks = Number((sp.maks ?? "").replace(/[^\d]/g, ""));
  const page = Math.max(1, Math.min(50, Number(sp.side) || 1));
  return { q, category: cat?.key ?? null, maxPrice: Number.isInteger(maks) && maks >= 1 && maks <= 100000 ? maks : null, size, page };
}

export function searchHref(s: Pick<Search, "q" | "category" | "maxPrice" | "size">, page = 1) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  const cat = CATEGORIES.find((c) => c.key === s.category);
  if (cat) p.set("kategori", cat.slug);
  if (s.maxPrice) p.set("maks", String(s.maxPrice));
  if (s.size) p.set("str", s.size);
  if (page > 1) p.set("side", String(page));
  const qs = p.toString();
  return qs ? `/soeg?${qs}` : "/soeg";
}

/** "uldfrakke · Dametøj · str. M · højst 500 kr" */
export function searchLabel(s: { query?: string | null; q?: string | null; category: string | null; max_price?: number | null; maxPrice?: number | null; size: string | null }) {
  const q = s.q ?? s.query ?? "";
  const max = s.maxPrice ?? s.max_price ?? null;
  const cat = CATEGORIES.find((c) => c.key === s.category);
  return [q ? `"${q}"` : "", cat?.label ?? "", s.size ? `str. ${s.size}` : "", max ? `højst ${max.toLocaleString("da-DK")} kr` : ""]
    .filter(Boolean)
    .join(" · ");
}

export const searchable = (s: Pick<Search, "q" | "category">) => s.q.length >= 2 || Boolean(s.category);
