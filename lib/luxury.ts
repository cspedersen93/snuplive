// Ægthedstjek af luksusvarer. Samme regler som i databasen (supabase/migrations/0017_aegthed.sql: luxury_brand og
// items_auth_rules). Ændres listen her, skal den også ændres dér.

/** Mærker, der altid skal ægthedstjekkes, uanset kategori og pris (de mest kopierede). */
export const LUXURY_BRANDS = [
  "louis vuitton", "vuitton", "lv", "gucci", "chanel", "hermès", "hermes", "prada", "dior", "fendi", "balenciaga",
  "bottega veneta", "celine", "céline", "saint laurent", "ysl", "burberry", "givenchy", "valentino", "loewe", "goyard",
  "miu miu", "rolex", "cartier", "omega", "patek philippe", "audemars piguet", "bulgari", "bvlgari", "van cleef",
  "moncler", "canada goose",
];

/** Ting i kategorien Luksus til mindst så mange kroner skal også tjekkes. */
export const LUXURY_MIN_PRICE = 1000;

const BRAND_RE = new RegExp(`(^|[^a-z0-9æøåéè])(${LUXURY_BRANDS.map((b) => b.replace(/ /g, "\\s+")).join("|")})(?=$|[^a-z0-9æøåéè])`, "i");

export function luxuryBrand(text: string) {
  return BRAND_RE.test(text);
}

/** Skal tingen ægthedstjekkes, før den kan sælges? */
export function needsAuth(i: { name: string; description?: string | null; category: string; price: number }) {
  return (i.category === "luksus" && i.price >= LUXURY_MIN_PRICE) || luxuryBrand(`${i.name} ${i.description ?? ""}`);
}

export type AuthStatus = "pending" | "approved" | "rejected" | null;

/** De billeder, sælgeren skal lægge op til ægthedstjekket. */
export const AUTH_SHOTS = [
  { key: "logo", label: "Logo og prægning tæt på", need: true },
  { key: "kode", label: "Serie- eller datokode (eller certifikat)", need: true },
  { key: "inde", label: "Indersiden og foeret", need: true },
  { key: "detaljer", label: "Syninger, lynlås og metaldele", need: true },
  { key: "kvittering", label: "Kvittering eller ægthedsbevis (hvis du har det)", need: false },
  { key: "ekstra", label: "Andet, der viser, at den er ægte", need: false },
] as const;
