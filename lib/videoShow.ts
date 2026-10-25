import type { SupabaseClient } from "@supabase/supabase-js";

// Videoannoncer (0019_videoannoncer.sql) ligger i et skjult "show" pr. sælger (kind = 'video'). Det skal aldrig vises
// som et show. Alle opslag her virker også, før 0019 er kørt (så findes der bare ingen videoannoncer).

/** Er 0019_videoannoncer.sql kørt? */
export async function videoListingsReady(sb: SupabaseClient, seller: string) {
  const { error } = await sb.from("shows").select("id").eq("seller_id", seller).eq("kind", "video").limit(1);
  return !error;
}

/** Sælgerens skjulte videoannonce-show, eller null. */
export async function videoShowId(sb: SupabaseClient, seller: string): Promise<string | null> {
  const { data, error } = await sb.from("shows").select("id").eq("seller_id", seller).eq("kind", "video").maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

