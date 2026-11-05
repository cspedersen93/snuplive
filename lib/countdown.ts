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

/** Henter nedtællingen for et show. Er 0034 ikke kørt, er den null, og ready er false. */
export async function fetchCountdown(sb: SupabaseClient, showId: string) {
  const { data, error } = await sb.from("shows").select("countdown_to").eq("id", showId).maybeSingle();
  if (error) return { ready: false, countdownTo: null as string | null };
  return { ready: true, countdownTo: ((data as { countdown_to?: string | null } | null)?.countdown_to ?? null) as string | null };
}
