import type { SupabaseClient } from "@supabase/supabase-js";

// Gæst i showet (0020_gaester.sql): op til 2 sælgere er med i værtens show. Alle opslag virker også, før 0020 er kørt
// (så er der bare ingen gæster).

export const MAX_GUESTS = 2;

export interface Guest {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_path: string | null;
}

/** Gæsterne i et show lige nu. */
export async function showGuests(sb: SupabaseClient, showId: string): Promise<Guest[]> {
  const { data, error } = await sb
    .from("show_guests")
    .select("joined_at,guest:profiles!show_guests_guest_id_fkey(id,handle,display_name,avatar_path)")
    .eq("show_id", showId)
    .is("left_at", null)
    .order("joined_at");
  if (error || !data) return [];
  return (data as unknown as { guest: Guest | null }[]).map((r) => r.guest).filter((g): g is Guest => Boolean(g));
}

/** Er brugeren gæst i showet? */
export async function isGuest(sb: SupabaseClient, showId: string, uid: string) {
  const { data, error } = await sb.rpc("is_show_guest", { p_show: showId, p_user: uid });
  return !error && data === true;
}

export interface GuestShow {
  id: string;
  title: string;
  status: "planned" | "live" | "ended";
  starts_at: string | null;
  host: { handle: string; avatar_path: string | null } | null;
}

/** Shows, brugeren er gæst i (og som ikke er slut). */
export async function myGuestShows(sb: SupabaseClient, uid: string): Promise<GuestShow[]> {
  const { data, error } = await sb
    .from("show_guests")
    .select("show:shows!show_guests_show_id_fkey(id,title,status,starts_at,removed_at,host:profiles!shows_seller_id_fkey(handle,avatar_path))")
    .eq("guest_id", uid)
    .is("left_at", null);
  if (error || !data) return [];
  return (data as unknown as { show: (GuestShow & { removed_at: string | null }) | null }[])
    .map((r) => r.show)
    .filter((s): s is GuestShow & { removed_at: string | null } => Boolean(s && s.status !== "ended" && !s.removed_at))
    .sort((a, b) => (a.status === "live" ? -1 : b.status === "live" ? 1 : Date.parse(a.starts_at ?? "") - Date.parse(b.starts_at ?? "")));
}

/** Viser "@lise og @hanne" (til tekster). */
export function guestNames(guests: { handle: string }[]) {
  const n = guests.map((g) => `@${g.handle}`);
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} og ${n[n.length - 1]}`;
}
