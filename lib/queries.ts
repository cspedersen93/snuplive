import { createPublicClient } from "@/lib/supabase/public";
import { SHOW_COLS, type ShowWithSeller } from "@/lib/types";

// Fremmednøgle-hints, så PostgREST ved, hvilken relation vi mener.
export const SELLER_EMBED = "seller:profiles!shows_seller_id_fkey(handle,display_name,area)";
export const ITEM_COUNT_EMBED = "items:items!items_show_id_fkey(count)";

export interface Listing {
  ok: boolean;
  live: ShowWithSeller[];
  upcoming: ShowWithSeller[];
}

/** Shows, der er live nu, og shows, der starter snart (offentlige data). */
export async function fetchListing(limitLive = 30, limitUpcoming = 20): Promise<Listing> {
  const sb = createPublicClient();
  if (!sb) return { ok: false, live: [], upcoming: [] };
  const sel = `${SHOW_COLS},${SELLER_EMBED},${ITEM_COUNT_EMBED}`;
  const since = new Date(Date.now() - 2 * 3600e3).toISOString();
  try {
    const [live, upcoming] = await Promise.all([
      sb.from("shows").select(sel).eq("status", "live").order("started_at", { ascending: false }).limit(limitLive),
      sb
        .from("shows")
        .select(sel)
        .eq("status", "planned")
        .gte("starts_at", since)
        .order("starts_at", { ascending: true })
        .limit(limitUpcoming),
    ]);
    return {
      ok: !live.error && !upcoming.error,
      live: (live.data ?? []) as unknown as ShowWithSeller[],
      upcoming: (upcoming.data ?? []) as unknown as ShowWithSeller[],
    };
  } catch {
    return { ok: false, live: [], upcoming: [] };
  }
}

export function itemCount(s: ShowWithSeller) {
  return s.items?.[0]?.count ?? 0;
}
