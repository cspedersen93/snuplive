import { createPublicClient } from "@/lib/supabase/public";
import { SHOW_COLS, type FeedItem, type ShowWithSeller } from "@/lib/types";

// Fremmednøgle-hints, så PostgREST ved, hvilken relation vi mener.
export const SELLER_EMBED = "seller:profiles!shows_seller_id_fkey(handle,display_name,area,avatar_path)";
export const ITEM_COUNT_EMBED = "items:items!items_show_id_fkey(count)";

export interface Listing {
  ok: boolean;
  live: ShowWithSeller[];
  upcoming: ShowWithSeller[];
}

/** Shows, der er live nu, og shows, der starter snart (offentlige data). */
export async function fetchListing(limitLive = 30, limitUpcoming = 20, category?: string): Promise<Listing> {
  const sel = `${SHOW_COLS},${SELLER_EMBED},${ITEM_COUNT_EMBED}`;
  const since = new Date(Date.now() - 2 * 3600e3).toISOString();
  try {
    const sb = createPublicClient();
    if (!sb) return { ok: false, live: [], upcoming: [] };
    // Shows, der er fjernet efter en anmeldelse, er ikke med.
    const shows = () => {
      const q = sb.from("shows").select(sel).is("removed_at", null);
      return category ? q.eq("category", category) : q;
    };
    const [live, upcoming] = await Promise.all([
      shows().eq("status", "live").order("started_at", { ascending: false }).limit(limitLive),
      shows()
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

/** Ting til forsiden, kategorier og "Til salg" (se items_feed i databasen). */
export async function fetchFeed(
  kind: "upcoming" | "live" | "for_sale" | "auctions",
  opts: { category?: string | null; limit?: number; offset?: number; seller?: string; exclude?: string } = {},
): Promise<FeedItem[]> {
  try {
    const sb = createPublicClient();
    if (!sb) return [];
    const { data, error } = await sb.rpc("items_feed", {
      p_kind: kind,
      p_category: opts.category ?? null,
      p_limit: opts.limit ?? 12,
      p_offset: opts.offset ?? 0,
      p_seller: opts.seller ?? null,
      p_exclude: opts.exclude ?? null,
    });
    if (error) return [];
    return (data ?? []) as FeedItem[];
  } catch {
    return [];
  }
}
