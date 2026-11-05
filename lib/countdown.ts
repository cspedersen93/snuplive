import type { SupabaseClient } from "@supabase/supabase-js";

// Nedtælling til live (0034_nedtaelling.sql): fælles for studiet, showets side og chatskærmen.

/** Valgene i studiet. */
export const COUNTDOWN_MINUTES = [1, 3, 5, 10] as const;

/** Er der en nedtælling i gang (eller lige slut, mens studiet går live)? Et kvarter efter giver vi op. */
export function countingDown(show: { status: string; countdown_to?: string | null }, now: number) {
  if (show.status !== "planned" || !show.countdown_to) return false;
  return Date.parse(show.countdown_to) > now - 15 * 60_000;
}

/** "4:32" eller "0:07". */
export function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Henter nedtællingen og ventemusikken for et show. Er 0034 ikke kørt, er de null, og ready er false. */
export async function fetchCountdown(sb: SupabaseClient, showId: string) {
  type Row = { countdown_to?: string | null; countdown_music?: string | null } | null;
  const none = { ready: false, countdownTo: null as string | null, music: null as string | null };
  let res = await sb.from("shows").select("countdown_to, countdown_music").eq("id", showId).maybeSingle();
  // En ældre udgave af 0034 uden ventemusik: nedtællingen virker stadig.
  if (res.error) res = await sb.from("shows").select("countdown_to").eq("id", showId).maybeSingle();
  if (res.error) return none;
  const row = res.data as Row;
  return { ready: true, countdownTo: row?.countdown_to ?? null, music: row?.countdown_music ?? null };
}
