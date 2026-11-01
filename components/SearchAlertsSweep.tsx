import { after } from "next/server";
import { sweepSearchAlerts } from "@/lib/searchAlerts";

/**
 * Søgeagenterne (0024_soegning.sql): efter hver side, serveren laver, køres de i baggrunden, højst hvert 3. minut pr. server.
 * Viser ingenting og gør ikke siden langsommere (det sker, efter svaret er sendt).
 */
export default function SearchAlertsSweep() {
  try {
    after(() => sweepSearchAlerts());
  } catch {
    // Uden for et sidekald springes de over.
  }
  return null;
}
