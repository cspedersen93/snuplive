"use client";

import { track as vaTrack } from "@vercel/analytics";

/**
 * En hændelse til statistikken (Vercel Web Analytics), fx "Køb" eller "Gik live". Ingen personlige oplysninger.
 * Hændelser vises først i Vercel med Pro-abonnementet. Uden statistik (fx lokalt) sker der ingenting.
 */
export function track(name: "Køb" | "Bud" | "Gik live" | "Følg" | "Venteliste" | "Delte klip", props?: Record<string, string | number | boolean>) {
  try {
    vaTrack(name, props);
  } catch {
    // Statistik må aldrig stoppe siden.
  }
}
