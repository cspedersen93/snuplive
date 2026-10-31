"use client";

import { vareTekst } from "@/lib/format";

export interface ToastDetail {
  text: string;
  href?: string;
  linkText?: string;
}

/** Viser en kort besked nederst på skærmen. */
export function toast(text: string, href?: string, linkText?: string) {
  window.dispatchEvent(new CustomEvent<ToastDetail>("snup:toast", { detail: { text, href, linkText } }));
}

/** Gør Supabase-fejl læselige for brugeren. */
export function errorText(err: unknown, fallback = "Noget gik galt. Prøv igen.") {
  const msg = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "";
  if (!msg) return fallback;
  if (/duplicate key.*handle/i.test(msg)) return "Brugernavnet er allerede taget.";
  if (/handle_check/i.test(msg)) return "Brugernavnet må kun have små bogstaver, tal, punktum og _ (3–24 tegn).";
  if (/row-level security|permission denied|JWT/i.test(msg)) return "Det har du ikke adgang til. Log ind igen.";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Ingen forbindelse. Tjek dit internet.";
  if (/check constraint/i.test(msg)) return "Tjek felterne og prøv igen.";
  return vareTekst(msg);
}
