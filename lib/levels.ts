/**
 * Niveauer og mærker for sælgere og købere (0032_niveauer.sql). Databasen regner dem ud fra de afsluttede handler;
 * her ligger navnene, kravene og hentningen. Er 0032 ikke kørt endnu, vises der bare ingen niveauer.
 */

export type Level = "ny" | "bronze" | "soelv" | "guld" | "vip";
export type Role = "seller" | "buyer";

export interface MemberLevel {
  id: string;
  seller_level: Level | null;
  buyer_level: Level | null;
  badges: BadgeKey[];
}

/** Ens egne tal fra my_level_progress() (og Backoffice). Vises aldrig for andre. */
export interface LevelProgress {
  seller_level: Level | null;
  buyer_level: Level;
  badges: BadgeKey[];
  hide_buyer_level: boolean;
  vip_seller: boolean;
  vip_buyer: boolean;
  sold: number;
  bought: number;
  auctions_won: number;
  shipped: number;
  on_time: number;
  fast_shipped: number;
  best_repeat: number;
  shows: number;
  rating_avg: number | null;
  rating_count: number;
}

export const LEVEL_ORDER: Level[] = ["ny", "bronze", "soelv", "guld", "vip"];
export const LEVEL_NAME: Record<Level, string> = { ny: "Ny", bronze: "Bronze", soelv: "Sølv", guld: "Guld", vip: "VIP" };

/** "Guld-sælger", "Ny køber". */
export function levelTitle(level: Level, role: Role) {
  const who = role === "seller" ? "sælger" : "køber";
  return level === "ny" ? `Ny ${who}` : `${LEVEL_NAME[level]}-${who}`;
}

/** Kravene, som de står i 0032_niveauer.sql. Bruges til forklaringen og til "så langt er du" på Min konto. */
export const SELLER_STEPS: { level: Exclude<Level, "ny">; sold: number; stars?: number; onTime?: boolean }[] = [
  { level: "bronze", sold: 5 },
  { level: "soelv", sold: 25, stars: 4.5 },
  { level: "guld", sold: 100, stars: 4.7, onTime: true },
  { level: "vip", sold: 250, stars: 4.7, onTime: true },
];
export const BUYER_STEPS: { level: Exclude<Level, "ny">; bought: number }[] = [
  { level: "bronze", bought: 3 },
  { level: "soelv", bought: 10 },
  { level: "guld", bought: 25 },
  { level: "vip", bought: 50 },
];

/** Hvad det kræver at nå et niveau, i én sætning. */
export function levelNeeds(level: Level, role: Role) {
  if (level === "ny") return role === "seller" ? "Alle sælgere starter her." : "Alle købere starter her.";
  if (role === "buyer") {
    const s = BUYER_STEPS.find((x) => x.level === level)!;
    return `${s.bought} købte varer${level === "vip" ? ", eller udvalgt af Relived" : ""}.`;
  }
  const s = SELLER_STEPS.find((x) => x.level === level)!;
  const parts = [`${s.sold} solgte varer`];
  if (s.stars) parts.push(`mindst ${String(s.stars).replace(".", ",")} stjerner`);
  if (s.onTime) parts.push("9 ud af 10 pakker sendt til tiden");
  return `${parts.join(", ").replace(/, ([^,]*)$/, " og $1")}${level === "vip" ? ", eller udvalgt af Relived" : ""}.`;
}

export type BadgeKey =
  | "stiftende_saelger"
  | "stiftende_koeber"
  | "foerste_koeb"
  | "foerste_show"
  | "budkonge"
  | "lynafsender"
  | "stamkunde"
  | "natteravn";

export const BADGES: Record<BadgeKey, { name: string; text: string; role: Role }> = {
  stiftende_saelger: { name: "Stiftende sælger", text: "En af de første 100 sælgere, der har solgt en vare på Relived.", role: "seller" },
  foerste_show: { name: "Første show", text: "Har holdt sit første live-show.", role: "seller" },
  lynafsender: { name: "Lynafsender", text: "Har sendt 10 pakker inden for et døgn efter betalingen.", role: "seller" },
  natteravn: { name: "Natteravn", text: "Har holdt et show, der startede efter kl. 22.", role: "seller" },
  stiftende_koeber: { name: "Stiftende køber", text: "En af de første 250 købere, der har fået en vare fra Relived.", role: "buyer" },
  foerste_koeb: { name: "Første køb", text: "Har fået sin første vare fra Relived.", role: "buyer" },
  budkonge: { name: "Budkonge", text: "Har vundet 10 budsalg.", role: "buyer" },
  stamkunde: { name: "Stamkunde", text: "Har handlet 3 gange hos den samme sælger.", role: "buyer" },
};
export const BADGE_ORDER = Object.keys(BADGES) as BadgeKey[];

const isLevel = (v: unknown): v is Level => typeof v === "string" && (LEVEL_ORDER as string[]).includes(v);
const isBadge = (v: unknown): v is BadgeKey => typeof v === "string" && v in BADGES;

export function toMemberLevel(row: { id: string; seller_level: unknown; buyer_level: unknown; badges: unknown }): MemberLevel {
  return {
    id: row.id,
    seller_level: isLevel(row.seller_level) ? row.seller_level : null,
    buyer_level: isLevel(row.buyer_level) ? row.buyer_level : null,
    badges: (Array.isArray(row.badges) ? row.badges : []).filter(isBadge),
  };
}

export function toProgress(raw: unknown): LevelProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (k: string) => Number(r[k] ?? 0) || 0;
  return {
    seller_level: isLevel(r.seller_level) ? r.seller_level : null,
    buyer_level: isLevel(r.buyer_level) ? r.buyer_level : "ny",
    badges: (Array.isArray(r.badges) ? r.badges : []).filter(isBadge),
    hide_buyer_level: r.hide_buyer_level === true,
    vip_seller: r.vip_seller === true,
    vip_buyer: r.vip_buyer === true,
    sold: n("sold"),
    bought: n("bought"),
    auctions_won: n("auctions_won"),
    shipped: n("shipped"),
    on_time: n("on_time"),
    fast_shipped: n("fast_shipped"),
    best_repeat: n("best_repeat"),
    shows: n("shows"),
    rating_avg: r.rating_avg == null ? null : Number(r.rating_avg),
    rating_count: n("rating_count"),
  };
}

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

/** Niveauer for op til 100 medlemmer. Fejler det (0032 ikke kørt), kommer der et tomt kort tilbage. */
export async function fetchLevels(sb: Rpc | null, ids: (string | null | undefined)[]): Promise<Map<string, MemberLevel>> {
  const out = new Map<string, MemberLevel>();
  const want = [...new Set(ids.filter((x): x is string => !!x))].slice(0, 100);
  if (!sb || !want.length) return out;
  try {
    const { data, error } = await sb.rpc("member_levels", { p_ids: want });
    if (error || !Array.isArray(data)) return out;
    for (const row of data) {
      const m = toMemberLevel(row as MemberLevel);
      out.set(m.id, m);
    }
  } catch {
    // Niveauerne er pynt: siden virker uden dem.
  }
  return out;
}

/** Et medlems niveau, eller null. */
export async function fetchLevel(sb: Rpc | null, id: string | null | undefined) {
  return id ? ((await fetchLevels(sb, [id])).get(id) ?? null) : null;
}

/** Hvor langt der er til næste niveau: { next, have, need } eller null, når man er på toppen. */
export function nextStep(p: LevelProgress, role: Role) {
  const cur = role === "seller" ? (p.seller_level ?? "ny") : p.buyer_level;
  const idx = LEVEL_ORDER.indexOf(cur);
  const next = LEVEL_ORDER[idx + 1] as Exclude<Level, "ny"> | undefined;
  if (!next) return null;
  if (role === "buyer") {
    const s = BUYER_STEPS.find((x) => x.level === next)!;
    return { next, have: Math.min(p.bought, s.bought), need: s.bought, extra: [] as string[] };
  }
  const s = SELLER_STEPS.find((x) => x.level === next)!;
  const extra: string[] = [];
  if (s.stars && p.rating_count > 0 && (p.rating_avg ?? 0) < s.stars) {
    extra.push(`Dine bedømmelser skal op på ${String(s.stars).replace(".", ",")} stjerner i snit (nu ${String(p.rating_avg ?? 0).replace(".", ",")}).`);
  }
  if (s.onTime && p.shipped > 0 && p.on_time * 10 < p.shipped * 9) {
    extra.push(`9 ud af 10 pakker skal sendes til tiden (nu ${p.on_time} af ${p.shipped}).`);
  }
  return { next, have: Math.min(p.sold, s.sold), need: s.sold, extra };
}
