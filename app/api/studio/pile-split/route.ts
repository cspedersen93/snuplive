import { fail, json } from "@/lib/api";
import { askClaude, rateLimiter, validImages } from "@/lib/claude";
import { PILE_MAX_FRAMES, parsePile, pilePrompt } from "@/lib/pile";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Claude ser op til 60 små billeder. Det kan tage et halvt minut.
export const maxDuration = 60;

// 6 bunker på 10 minutter pr. sælger er rigeligt.
const tooMany = rateLimiter(6, 10 * 60_000);

/**
 * "Film bunken": deler stillbillederne fra en video i varer. { images: base64-JPEG[], step: sekunder imellem }.
 * Svarer { items: [{ first, last, best }] } (numre fra 0) eller { items: null, why: "off" | "error" | "unclear" }.
 * Der gemmes ingenting her. Sælgeren godkender hver vare bagefter.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return fail("Log ind først.", 401);
  const body = (await req.json().catch(() => null)) as { images?: unknown; step?: unknown } | null;
  const images = body?.images;
  if (!validImages(images, PILE_MAX_FRAMES, 60_000) || images.length < 2) return fail("Videoen kunne ikke læses. Prøv en kortere video.", 400);
  const { data: me } = await supabase.from("profiles").select("is_seller").eq("id", uid).maybeSingle();
  if (!me?.is_seller) return fail("Bliv sælger først.", 403);
  if (tooMany(uid)) return fail("Du har filmet mange bunker på kort tid. Vent et par minutter.", 429);

  const step = typeof body?.step === "number" && body.step > 0 && body.step < 30 ? body.step : 1.5;
  const r = await askClaude(images, pilePrompt(images.length, step), { maxTokens: 1500, label: "bunken", timeoutMs: 50_000 });
  if ("why" in r) return json({ items: null, why: r.why });
  const items = parsePile(r.text, images.length);
  if (!items) {
    console.error("[relived] uventet svar fra Claude på bunken:", r.text.slice(0, 120));
    return json({ items: null, why: "unclear" });
  }
  return json({ items });
}
