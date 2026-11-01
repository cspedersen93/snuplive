"use client";

/** Fortæl serveren, at der er kommet noget nyt, så søgeagenterne kan give besked (se app/api/search-alerts). */
export function pingSearchAlerts() {
  try {
    void fetch("/api/search-alerts", { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    // Søgeagenterne kører også efter sidevisninger og i det daglige job.
  }
}
