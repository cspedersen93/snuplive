import type { SupabaseClient } from "@supabase/supabase-js";
import { buyerFee } from "@/lib/pricing";
import { createPublicClient } from "@/lib/supabase/public";

// Gratis-kampagnen: 0 kr i køberbeskyttelse i en periode (Backoffice → Indstillinger).
// Selve beskyttelsen gælder stadig: pengene holdes tilbage, til køberen har fået varen. Det er kun gebyret, der er 0 kr.
// Kampagnen ligger i settings under nøglen "fee_free": { from, until } og, når den er stoppet, også { ended, reason }.
// Den stopper af sig selv på slutdatoen, og når den anslåede udgift rammer loftet (FEE_FREE_CAP).

export const FEE_FREE_KEY = "fee_free";
/** Kampagnens længde, når den startes uden en dato. */
export const FEE_FREE_MONTHS = 6;
/** Loftet over, hvad kampagnen må koste i kroner (skøn). Står kun her i koden, ikke i databasen, så besøgende ikke kan se det. */
export const FEE_FREE_CAP = 30_000;

/**
 * Skøn over, hvad en betaling koster hos Stripe (november 2026): kort 1,5 % + 1,80 kr, udbetaling 0,25 % + ca. 0,75 kr
 * og ca. 15 kr om måneden pr. sælger, der får penge udbetalt. Ret tallene, når de rigtige priser i Stripe-aftalen er kendt.
 */
export const PAY_COST = { cardPct: 0.015, cardFixed: 1.8, payoutPct: 0.0025, payoutFixed: 0.75, sellerMonth: 15 } as const;

export interface FeeFreeSetting {
  from: string;
  until: string;
  ended?: string;
  reason?: "manual" | "cap";
}

export interface FeeFreeState {
  /** Er gebyret 0 kr lige nu? */
  active: boolean;
  /** Sidste dag i kampagnen (ISO), når den er i gang. */
  until: string | null;
}

const OFF: FeeFreeState = { active: false, until: null };

export function parseFeeFree(value: unknown): FeeFreeSetting | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.from !== "string" || typeof v.until !== "string") return null;
  if (Number.isNaN(Date.parse(v.from)) || Number.isNaN(Date.parse(v.until))) return null;
  return {
    from: v.from,
    until: v.until,
    ...(typeof v.ended === "string" ? { ended: v.ended } : {}),
    ...(v.reason === "manual" || v.reason === "cap" ? { reason: v.reason } : {}),
  };
}

export function feeFreeActive(s: FeeFreeSetting | null, now = Date.now()): boolean {
  return Boolean(s && !s.ended && now >= Date.parse(s.from) && now < Date.parse(s.until));
}

const toState = (s: FeeFreeSetting | null): FeeFreeState => (feeFreeActive(s) ? { active: true, until: s!.until } : OFF);

const TTL = 15_000;
let cache: { value: FeeFreeState; at: number } | null = null;

/** Til siderne: er gebyret 0 kr lige nu? Huskes 15 sekunder. Kan det ikke læses, gælder det normale gebyr. */
export async function feeFreeState(): Promise<FeeFreeState> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  let value = OFF;
  try {
    const sb = createPublicClient();
    if (sb) {
      const { data, error } = await sb.from("settings").select("value").eq("key", FEE_FREE_KEY).maybeSingle();
      if (!error) value = toState(parseFeeFree(data?.value));
    }
  } catch {
    value = OFF;
  }
  cache = { value, at: Date.now() };
  return value;
}

export function clearFeeFree() {
  cache = null;
}

/** Til betalingen og Backoffice: læser indstillingen frisk hver gang. */
export async function readFeeFree(admin: SupabaseClient): Promise<FeeFreeSetting | null> {
  const { data, error } = await admin.from("settings").select("value").eq("key", FEE_FREE_KEY).maybeSingle();
  return error ? null : parseFeeFree(data?.value);
}

const dayFmt = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Copenhagen" });

/** "9. maj 2027" */
export function feeFreeDay(iso: string) {
  return dayFmt.format(new Date(iso));
}

/** Slutningen af dagen (23:59:59 dansk tid) for en dato som "2027-05-09". */
export function endOfDay(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  for (const off of ["+01:00", "+02:00"]) {
    const d = new Date(`${date}T23:59:59${off}`);
    if (!Number.isNaN(d.getTime()) && hourFmt.format(d) === "23") return d.toISOString();
  }
  return null;
}

/** Datoen (ÅÅÅÅ-MM-DD, dansk tid) så mange måneder frem. Bruges som forslag til slutdato. */
export function monthsAhead(months: number, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(now).split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1 + months, parts[2]));
  return d.toISOString().slice(0, 10);
}

export interface FeeFreeSpend {
  /** Betalte ordrer i kampagnen. */
  orders: number;
  /** Det, køberne har betalt i alt (varer og fragt). */
  volume: number;
  /** Anslået udgift til betaling og udbetaling. Det er den, loftet måles på. */
  cost: number;
  /** Det gebyr, køberne ville have betalt uden kampagnen. */
  waived: number;
}

/**
 * Hvad kampagnen har kostet indtil nu (skøn): betalingsgebyrer på de ordrer, der er betalt i perioden uden gebyr.
 * Refunderede ordrer tæller med, for betalingsgebyret er tabt alligevel.
 */
export async function feeFreeSpend(admin: SupabaseClient, s: FeeFreeSetting): Promise<FeeFreeSpend> {
  const out: FeeFreeSpend = { orders: 0, volume: 0, cost: 0, waived: 0 };
  const to = s.ended ?? s.until;
  const { data, error } = await admin
    .from("orders")
    .select("seller_id,items_amount,total_amount,fee_amount,paid_at")
    .not("paid_at", "is", null)
    .gte("paid_at", s.from)
    .lte("paid_at", to)
    .eq("fee_amount", 0)
    .limit(50_000);
  if (error || !data) return out;
  const sellerMonths = new Set<string>();
  for (const o of data as { seller_id: string; items_amount: number; total_amount: number; paid_at: string }[]) {
    out.orders += 1;
    out.volume += o.total_amount;
    out.cost += o.total_amount * PAY_COST.cardPct + PAY_COST.cardFixed + o.items_amount * PAY_COST.payoutPct + PAY_COST.payoutFixed;
    out.waived += buyerFee(o.items_amount);
    sellerMonths.add(`${o.seller_id}:${o.paid_at.slice(0, 7)}`);
  }
  out.cost = Math.round(out.cost + sellerMonths.size * PAY_COST.sellerMonth);
  return out;
}

/**
 * Stopper kampagnen, hvis den anslåede udgift har ramt loftet. Kaldes, når en ordre er betalt, og når Backoffice åbnes.
 * Giver indstillingen, som den er bagefter, og tallene (læs dem herfra: et nyt opslag i samme sidevisning kan være husket).
 */
export async function enforceFeeFreeCap(admin: SupabaseClient): Promise<{ setting: FeeFreeSetting | null; spend: FeeFreeSpend | null; stopped: boolean }> {
  const s = await readFeeFree(admin);
  if (!s) return { setting: null, spend: null, stopped: false };
  const spend = await feeFreeSpend(admin, s);
  if (!feeFreeActive(s) || spend.cost < FEE_FREE_CAP) return { setting: s, spend, stopped: false };
  const value: FeeFreeSetting = { ...s, ended: new Date().toISOString(), reason: "cap" };
  const { error } = await admin.from("settings").upsert({ key: FEE_FREE_KEY, value, updated_at: value.ended });
  if (error) return { setting: s, spend, stopped: false };
  clearFeeFree();
  console.info("[snuplive] gratis-kampagnen er stoppet: loftet er nået", spend.cost);
  return { setting: value, spend, stopped: true };
}

/**
 * Til teksterne på siden (ikke til priser i kurven): som feeFreeState, men på en testside hos Vercel (preview)
 * vises kampagneteksterne altid med en slutdato seks måneder frem, så de kan læses, før kampagnen er startet.
 */
export async function feeFreeCopy(): Promise<FeeFreeState> {
  const real = await feeFreeState();
  if (real.active || process.env.VERCEL_ENV !== "preview") return real;
  const d = new Date();
  d.setMonth(d.getMonth() + FEE_FREE_MONTHS);
  return { active: true, until: d.toISOString() };
}
