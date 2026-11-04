import { fail, json } from "@/lib/api";
import { askClaude, rateLimiter, validImages } from "@/lib/claude";
import { category, sizeText } from "@/lib/format";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGES = 8;
// Små JPEG-billeder (512 × 640) fylder typisk 20-60 kB. Base64 gør dem en tredjedel større.
const MAX_B64 = 300_000;

// Bremse mod mange kald fra samme sælger på kort tid.
const tooMany = rateLimiter(20, 60_000);

/**
 * Claude vælger det billede, hvor tingen ses bedst.
 * Svarer { pick: 1..n } (nummeret på billedet), { pick: 0 } (tingen ses ikke på nogen af dem)
 * eller { pick: null } (Claude er ikke sat op eller svarede ikke; studiet vælger så selv).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return fail("Log ind først.", 401);

  const body = (await req.json().catch(() => null)) as { itemId?: unknown; images?: unknown; mode?: unknown } | null;
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const images = Array.isArray(body?.images) ? body.images : [];
  if (!images.length || images.length > MAX_IMAGES) return fail("Forkert antal billeder.", 400);
  if (!validImages(images, MAX_IMAGES, MAX_B64)) return fail("Billederne kunne ikke læses.", 400);
  if (body?.mode === "video") return videoPick(supabase, uid, images);
  if (!UUID.test(itemId)) return fail("Ukendt vare.", 400);

  const { data: item } = await supabase
    .from("items")
    .select("id,name,size,condition,category,seller_id,show:shows!items_show_id_fkey(status,category,ended_at)")
    .eq("id", itemId)
    .maybeSingle();
  const it = item as unknown as {
    name: string;
    size: string | null;
    condition: string | null;
    category: string | null;
    seller_id: string;
    show: { status: string; category: string; ended_at: string | null } | null;
  } | null;
  if (!it || it.seller_id !== uid || !it.show) return fail("Varen findes ikke.", 404);
  // Kun mens showet kører (eller lige er slut: billederne af den sidste ting sendes, når showet afsluttes).
  const justEnded = it.show.status === "ended" && it.show.ended_at && Date.now() - new Date(it.show.ended_at).getTime() < 5 * 60_000;
  if (it.show.status !== "live" && !justEnded) return fail("Showet kører ikke.", 409);
  if (tooMany(uid)) return fail("For mange billeder på kort tid.", 429);

  const cat = category(it.category ?? it.show.category);
  const what = [it.name, sizeText(it.size)?.replace(/^Str\./, "str.") ?? "", it.condition ?? "", cat.word].filter(Boolean).join(", ");
  const r = await askClaude(
    images,
    `Billederne er taget fra et live-videoshow, hvor en sælger viser en brugt ting frem: "${what}". ` +
      "Vælg det billede, der er bedst som produktbillede i en annonce for tingen: tingen skal kunne ses tydeligt, " +
      "være i fokus og gerne fylde meget. Sælgeren må godt være med, men billedet skal vise tingen. " +
      "Svar kun med billedets nummer. Svar 0, hvis tingen ikke kan ses på nogen af billederne.",
  );
  if ("why" in r) return json({ pick: null, why: r.why });
  const m = /\d+/.exec(r.text);
  const n = m ? Number(m[0]) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > images.length) {
    console.error("[relived] uventet svar fra Claude på billedvalget:", r.text.slice(0, 80));
    return json({ pick: null, why: "unclear" });
  }
  return json({ pick: n });
}

/**
 * Videoannoncer: sælgeren har filmet tingen (uden at gå live). Claude vælger op til 4 billeder til annoncen, det bedste først.
 * Svarer { picks: [3, 1, 6] } (numrene på billederne), { picks: [] } (tingen ses ikke) eller { picks: null } (Claude er ikke
 * sat op eller svarede ikke; siden vælger så selv de skarpeste).
 */
async function videoPick(supabase: Awaited<ReturnType<typeof createClient>>, uid: string, images: string[]) {
  const { data: me } = await supabase.from("profiles").select("is_seller").eq("id", uid).maybeSingle();
  if (!me?.is_seller) return fail("Bliv sælger først.", 403);
  if (tooMany(uid)) return fail("For mange billeder på kort tid.", 429);
  const r = await askClaude(
    images,
    "Billederne er taget fra en kort video, hvor en sælger filmer en brugt ting, som skal sælges i en annonce. " +
      "Vælg op til 4 billeder til annoncen, det bedste først. Det første bliver forsidebilledet: tingen skal ses tydeligt, " +
      "være i fokus og gerne fylde meget. Vælg gerne de andre, så de viser tingen fra forskellige sider eller tæt på " +
      "(fx mærke eller detaljer). Spring uskarpe billeder og billeder uden tingen over. " +
      "Svar kun med numrene adskilt af komma, fx 3, 1, 6. Svar 0, hvis tingen ikke kan ses på nogen af billederne.",
  );
  if ("why" in r) return json({ picks: null, why: r.why });
  const nums = (r.text.match(/\d+/g) ?? []).map(Number);
  if (!nums.length || nums.some((n) => !Number.isInteger(n) || n < 0 || n > images.length)) {
    console.error("[relived] uventet svar fra Claude på billedvalget (video):", r.text.slice(0, 80));
    return json({ picks: null, why: "unclear" });
  }
  const picks = [...new Set(nums.filter((n) => n > 0))].slice(0, 4);
  return json({ picks });
}
