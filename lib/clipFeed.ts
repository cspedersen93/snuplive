import type { SupabaseClient } from "@supabase/supabase-js";

// Klip-feedet ("Swipe og køb"): usolgte ting fra afsluttede shows, som har et videoklip.

export interface FeedClip {
  id: string;
  name: string;
  size: string | null;
  condition: string | null;
  price: number;
  images: string[] | null;
  clip_path: string;
  clip_at: string | null;
  seller_id: string;
  seller: { handle: string; avatar_path: string | null; area: string | null } | null;
}

export const CLIP_BATCH = 12;

const COLS =
  "id,name,size,condition,price,images,clip_path,clip_at,seller_id," +
  "show:shows!items_show_id_fkey!inner(status,removed_at)," +
  "seller:profiles!items_seller_id_fkey(handle,avatar_path,area)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function base(sb: SupabaseClient<any, any, any>) {
  return sb
    .from("items")
    .select(COLS)
    .eq("status", "unsold")
    .eq("for_sale", true)
    .is("removed_at", null)
    .not("clip_path", "is", null)
    .eq("show.status", "ended")
    .is("show.removed_at", null);
}

function clean(rows: unknown[] | null): FeedClip[] {
  return ((rows ?? []) as (FeedClip & { show?: unknown })[])
    .filter((r) => r.clip_path && r.seller)
    .map(({ show: _show, ...r }) => r);
}

/** Bland sælgerne, så én sælger med mange ting ikke fylder hele feedet i træk. */
export function mixSellers(list: FeedClip[]) {
  const by = new Map<string, FeedClip[]>();
  for (const c of list) by.set(c.seller_id, [...(by.get(c.seller_id) ?? []), c]);
  const queues = [...by.values()];
  const out: FeedClip[] = [];
  while (out.length < list.length) for (const q of queues) if (q.length) out.push(q.shift() as FeedClip);
  return out;
}

/** Nyeste klip først. Giver null, hvis klippene ikke findes i databasen endnu (0015_klip.sql). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadClips(sb: SupabaseClient<any, any, any>, offset: number, limit = CLIP_BATCH): Promise<FeedClip[] | null> {
  const { data, error } = await base(sb)
    .order("clip_at", { ascending: false, nullsFirst: false })
    .order("id")
    .range(offset, offset + limit - 1);
  if (error) return null;
  return mixSellers(clean(data));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadClip(sb: SupabaseClient<any, any, any>, id: string): Promise<FeedClip | null> {
  const { data, error } = await base(sb).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return clean([data])[0] ?? null;
}
