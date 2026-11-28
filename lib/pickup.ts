import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Afhentning (0041_afhentning.sql): køber og sælger bekræfter begge, når varen skifter hænder, og først derefter
 * afsluttes ordren, og pengene sendes til sælgeren. Før filen er kørt, findes kolonnerne ikke, og den gamle regel
 * gælder: køberen bekræfter alene.
 */
export interface PickupMarks {
  /** Hvornår køberen har bekræftet, eller null. */
  buyer: string | null;
  /** Hvornår sælgeren har bekræftet, eller null. */
  seller: string | null;
}

/** Databasens svar, når en kolonne ikke findes (filen er ikke kørt endnu). */
export function missingColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist/i.test(error.message ?? "");
}

/**
 * Er 0041_afhentning.sql kørt? Bruges dér, hvor svaret afgør, om der sendes penge. Derfor kaster den ved alle
 * andre fejl end "kolonnen findes ikke", så en ustabil database aldrig bliver læst som "brug den gamle regel".
 */
export async function pickupReady(sb: SupabaseClient): Promise<boolean> {
  const { error } = await sb.from("orders").select("pickup_buyer_at").limit(1);
  if (!error) return true;
  if (missingColumn(error)) return false;
  throw error;
}

/** Hvem har bekræftet på én ordre? null = filen er ikke kørt. Kaster ved andre fejl (se pickupReady). */
export async function pickupMarks(sb: SupabaseClient, orderId: string): Promise<PickupMarks | null> {
  const { data, error } = await sb.from("orders").select("pickup_buyer_at,pickup_seller_at").eq("id", orderId).maybeSingle();
  if (error) {
    if (missingColumn(error)) return null;
    throw error;
  }
  const row = data as { pickup_buyer_at: string | null; pickup_seller_at: string | null } | null;
  return { buyer: row?.pickup_buyer_at ?? null, seller: row?.pickup_seller_at ?? null };
}

/**
 * Til siderne (Mine køb, studiet, admin): hvem har bekræftet på de her ordrer? null = filen er ikke kørt, eller
 * noget fejlede. Så viser siden den gamle knap, og serveren afgør stadig selv, hvad et tryk betyder.
 */
export async function fetchPickupMarks(sb: SupabaseClient, orderIds: string[]): Promise<Record<string, PickupMarks> | null> {
  const ids = [...new Set(orderIds)].filter(Boolean);
  if (!ids.length) return {};
  const { data, error } = await sb.from("orders").select("id,pickup_buyer_at,pickup_seller_at").in("id", ids);
  if (error) return null;
  const out: Record<string, PickupMarks> = {};
  for (const r of (data ?? []) as { id: string; pickup_buyer_at: string | null; pickup_seller_at: string | null }[]) {
    out[r.id] = { buyer: r.pickup_buyer_at ?? null, seller: r.pickup_seller_at ?? null };
  }
  return out;
}
