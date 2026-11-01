"use client";

import type { AiListing } from "@/lib/aiListing";
import { blobToBase64 } from "@/lib/bestPhoto";
import { fitImage } from "@/lib/resizeImage";

const WHY: Record<string, string> = {
  off: "AI er ikke slået til endnu. Udfyld felterne selv.",
  error: "AI'en svarede ikke. Prøv igen om lidt, eller udfyld felterne selv.",
  unclear: "AI'en kunne ikke læse billederne. Prøv med et tydeligere billede, eller udfyld felterne selv.",
  no_item: "AI'en kunne ikke se en vare på billederne. Tag et billede, hvor varen fylder det meste.",
};

/**
 * Sender billederne (gjort små) til /api/studio/ai-listing. Giver forslaget eller en dansk fejltekst.
 */
export async function askAiListing(images: Blob[], hint?: string): Promise<{ listing: AiListing } | { error: string }> {
  try {
    const small = await Promise.all(images.slice(0, 6).map((b) => fitImage(b, 768, 0.8)));
    const data = await Promise.all(small.map(blobToBase64));
    const r = await fetch("/api/studio/ai-listing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ images: data, hint }),
    });
    const j = (await r.json().catch(() => null)) as { listing?: AiListing | null; why?: string; error?: string } | null;
    if (!r.ok) return { error: j?.error || WHY.error };
    if (j?.listing) return { listing: j.listing };
    return { error: WHY[j?.why ?? "error"] ?? WHY.error };
  } catch {
    return { error: WHY.error };
  }
}

/** Hvad sælgeren skal tjekke, som en sætning: "Tjek størrelse, mærke og mål." */
export function checkText(unsure: string[]) {
  const u = unsure.length ? unsure : ["mål"];
  const list = u.length > 1 ? `${u.slice(0, -1).join(", ")} og ${u[u.length - 1]}` : u[0];
  return `Tjek ${list}.`;
}
