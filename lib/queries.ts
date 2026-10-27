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

let lastSweep = 0;

/**
 * Lukker shows, der ikke har fået et livstegn fra studiet i 15 minutter (end_stale_shows i databasen).
 * Kaldes, før vi viser hvem der er live, højst hvert 30. sekund pr. server. Fejl ignoreres.
 */
export async function sweepStaleShows() {
  if (Date.now() - lastSweep < 30_000) return;
  lastSweep = Date.now();
  try {
    const sb = createPublicClient();
    if (sb) await sb.rpc("end_stale_shows");
  } catch {
    // Listen virker stadig; det daglige job lukker showet bagefter.
  }
}

/** Shows, der er live nu, og shows, der starter snart (offentlige data). */
export async function fetchListing(limitLive = 30, limitUpcoming = 20, category?: string): Promise<Listing> {
  const sel = `${SHOW_COLS},${SELLER_EMBED},${ITEM_COUNT_EMBED}`;
  const since = new Date(Date.now() - 2 * 3600e3).toISOString();
  try {
    const sb = createPublicClient();
    if (!sb) return { ok: false, live: [], upcoming: [] };
    await sweepStaleShows();
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
    const out = {
      ok: !live.error && !upcoming.error,
      live: (live.data ?? []) as unknown as ShowWithSeller[],
      upcoming: (upcoming.data ?? []) as unknown as ShowWithSeller[],
    };
    await markEnglish(sb, [...out.live, ...out.upcoming]);
    return out;
  } catch {
    return { ok: false, live: [], upcoming: [] };
  }
}

/**
 * Sætter language = "en" på de shows, der er på engelsk (mærket "English").
 * Sproget er ikke med i SHOW_COLS, så siden virker, før 0023_engelsk.sql er kørt. Så sker der bare ingenting.
 */
export async function markEnglish(sb: NonNullable<ReturnType<typeof createPublicClient>>, shows: ShowWithSeller[]) {
  if (!shows.length) return;
  const { data, error } = await sb
    .from("shows")
    .select("id")
    .in("id", shows.map((s) => s.id))
    .eq("language", "en");
  if (error || !data?.length) return;
  const en = new Set((data as { id: string }[]).map((r) => r.id));
  for (const s of shows) if (en.has(s.id)) s.language = "en";
}

/** Shows på engelsk, der er live eller starter snart (siden /en). Tom liste, før 0023_engelsk.sql er kørt. */
export async function fetchEnglishShows(limit = 12): Promise<ShowWithSeller[]> {
  try {
    const sb = createPublicClient();
    if (!sb) return [];
    const since = new Date(Date.now() - 2 * 3600e3).toISOString();
    const sel = `${SHOW_COLS},${SELLER_EMBED},${ITEM_COUNT_EMBED}`;
    const base = () => sb.from("shows").select(sel).is("removed_at", null).eq("language", "en");
    const [live, upcoming] = await Promise.all([
      base().eq("status", "live").order("started_at", { ascending: false }).limit(limit),
      base().eq("status", "planned").gte("starts_at", since).order("starts_at", { ascending: true }).limit(limit),
    ]);
    if (live.error || upcoming.error) return [];
    const shows = [...(live.data ?? []), ...(upcoming.data ?? [])] as unknown as ShowWithSeller[];
    for (const s of shows) s.language = "en";
    return shows.slice(0, limit);
  } catch {
    return [];
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
