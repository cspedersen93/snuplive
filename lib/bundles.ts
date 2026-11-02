import type { SupabaseClient } from "@supabase/supabase-js";
import { hasBundle, type BundleTiers } from "@/lib/pricing";

/**
 * Sælgernes samlerabat (0027_samlerabat.sql). Uden filen, eller hvis noget fejler, er der ingen rabat,
 * så kurven og betalingen virker som før.
 */
export async function fetchBundles(sb: SupabaseClient, sellerIds: string[]): Promise<Map<string, BundleTiers>> {
  const out = new Map<string, BundleTiers>();
  const ids = [...new Set(sellerIds)].filter(Boolean);
  if (!ids.length) return out;
  const { data, error } = await sb.from("bundle_discounts").select("seller_id,pct2,pct3").in("seller_id", ids);
  if (error) return out;
  for (const r of (data ?? []) as { seller_id: string; pct2: number; pct3: number }[]) {
    const b = { pct2: Number(r.pct2) || 0, pct3: Number(r.pct3) || 0 };
    if (hasBundle(b)) out.set(r.seller_id, b);
  }
  return out;
}

/** Én sælgers samlerabat, eller null. */
export async function fetchBundle(sb: SupabaseClient, sellerId: string): Promise<BundleTiers | null> {
  return (await fetchBundles(sb, [sellerId])).get(sellerId) ?? null;
}
