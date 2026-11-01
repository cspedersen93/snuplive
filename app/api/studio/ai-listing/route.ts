import { aiListingPrompt, parseAiListing } from "@/lib/aiListing";
import { fail, json } from "@/lib/api";
import { askClaude, rateLimiter, validImages } from "@/lib/claude";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_IMAGES = 6;
// 30 annoncer på 10 minutter pr. sælger er rigeligt til at lægge en hel bunke i køen.
const tooMany = rateLimiter(30, 10 * 60_000);

/**
 * "AI skriver annoncen": Claude ser billederne af varen og foreslår navn, størrelse, stand, kategori, beskrivelse og
 * prisleje. Svarer { listing } eller { listing: null, why: "off" | "error" | "unclear" | "no_item" }.
 * Sælgeren tjekker og retter altid forslaget, før varen bliver gemt.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return fail("Log ind først.", 401);
  const body = (await req.json().catch(() => null)) as { images?: unknown; hint?: unknown } | null;
  const images = body?.images;
  if (!validImages(images, MAX_IMAGES)) return fail("Billederne kunne ikke læses. Prøv med færre eller mindre billeder.", 400);
  const { data: me } = await supabase.from("profiles").select("is_seller").eq("id", uid).maybeSingle();
  if (!me?.is_seller) return fail("Bliv sælger først.", 403);
  if (tooMany(uid)) return fail("Du har brugt AI'en mange gange på kort tid. Vent et par minutter.", 429);

  const hint = typeof body?.hint === "string" ? body.hint.trim() : "";
  const r = await askClaude(images, aiListingPrompt(hint || undefined), { maxTokens: 1200, label: "annoncen", timeoutMs: 30_000 });
  if ("why" in r) return json({ listing: null, why: r.why });
  const listing = parseAiListing(r.text);
  if (listing === "no_item") return json({ listing: null, why: "no_item" });
  if (!listing) {
    console.error("[relived] uventet svar fra Claude på annoncen:", r.text.slice(0, 120));
    return json({ listing: null, why: "unclear" });
  }
  return json({ listing });
}
