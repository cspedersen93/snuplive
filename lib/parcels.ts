import type { SupabaseClient } from "@supabase/supabase-js";
import { isParcel, type Parcel } from "@/lib/pricing";

/**
 * Sælgernes valg af pakkestørrelse på varerne (0030_pakkestoerrelse.sql). Uden filen, eller hvis noget fejler,
 * er kortet tomt, og varerne bruger kategoriens standard (lib/pricing.ts: itemParcel).
 */
export async function fetchPackageSizes(sb: SupabaseClient, itemIds: string[]): Promise<Map<string, Parcel>> {
  const out = new Map<string, Parcel>();
  const ids = [...new Set(itemIds)].filter(Boolean);
  if (!ids.length) return out;
  const { data, error } = await sb.from("items").select("id,package_size").in("id", ids);
  if (error) return out;
  for (const r of (data ?? []) as { id: string; package_size: string | null }[]) {
    if (isParcel(r.package_size)) out.set(r.id, r.package_size);
  }
  return out;
}

/** Er 0030_pakkestoerrelse.sql kørt? Så kan sælgeren vælge pakkestørrelsen på varen. */
export async function packageSizesReady(sb: SupabaseClient | null): Promise<boolean> {
  if (!sb) return false;
  const { error } = await sb.from("items").select("package_size").limit(1);
  return !error;
}

/**
 * Varer, sælgeren har sat til "Kun afhentning" (0036_kun_afhentning.sql), fordi de er for store til en pakkeshop.
 * Uden filen, eller hvis noget fejler, er sættet tomt, og køberen kan vælge mellem pakkeshop og afhentning som før.
 */
export async function fetchPickupOnly(sb: SupabaseClient, itemIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = [...new Set(itemIds)].filter(Boolean);
  if (!ids.length) return out;
  const { data, error } = await sb.from("items").select("id,pickup_only").in("id", ids);
  if (error) return out;
  for (const r of (data ?? []) as { id: string; pickup_only: boolean | null }[]) {
    if (r.pickup_only === true) out.add(r.id);
  }
  return out;
}

/** Er 0036_kun_afhentning.sql kørt? Så kan sælgeren sætte en vare til kun afhentning. */
export async function pickupOnlyReady(sb: SupabaseClient | null): Promise<boolean> {
  if (!sb) return false;
  const { error } = await sb.from("items").select("pickup_only").limit(1);
  return !error;
}
