import { fail, json } from "@/lib/api";
import { unquoteEnv } from "@/lib/env";
import { category } from "@/lib/format";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGES = 8;
// Små JPEG-billeder (512 × 640) fylder typisk 20-60 kB. Base64 gør dem en tredjedel større.
const MAX_B64 = 300_000;
const MODEL_DEFAULT = "claude-haiku-5-5";

// Bremse mod mange kald fra samme sælger på kort tid (pr. server, nok til at stoppe et løbsk script).
const recent = new Map<string, number[]>();
function tooMany(uid: string) {
  const now = Date.now();
  const list = (recent.get(uid) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  recent.set(uid, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 20;
}

/**
 * Claude vælger det billede, hvor tingen ses bedst.
 * Svarer { pick: 1..n } (nummeret på billedet), { pick: 0 } (tingen ses ikke på nogen af dem)
 * eller { pick: null } (Claude er ikke sat op eller svarede ikke; studiet vælger så selv).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return fail("Log ind først.", 401);

  const body = (await req.json().catch(() => null)) as { itemId?: unknown; images?: unknown } | null;
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const images = Array.isArray(body?.images) ? body.images : [];
  if (!UUID.test(itemId)) return fail("Ukendt ting.", 400);
  if (!images.length || images.length > MAX_IMAGES) return fail("Forkert antal billeder.", 400);
  if (!images.every((b) => typeof b === "string" && b.length > 100 && b.length <= MAX_B64 && /^[A-Za-z0-9+/=]+$/.test(b)))
    return fail("Billederne kunne ikke læses.", 400);

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
  if (!it || it.seller_id !== uid || !it.show) return fail("Tingen findes ikke.", 404);
  // Kun mens showet kører (eller lige er slut: billederne af den sidste ting sendes, når showet afsluttes).
  const justEnded = it.show.status === "ended" && it.show.ended_at && Date.now() - new Date(it.show.ended_at).getTime() < 5 * 60_000;
  if (it.show.status !== "live" && !justEnded) return fail("Showet kører ikke.", 409);
  if (tooMany(uid)) return fail("For mange billeder på kort tid.", 429);

  const key = unquoteEnv(process.env.ANTHROPIC_API_KEY);
  if (!key) return json({ pick: null, why: "off" });

  const cat = category(it.category ?? it.show.category);
  const what = [it.name, it.size ? `str. ${it.size}` : "", it.condition ?? "", cat.word].filter(Boolean).join(", ");
  const content: unknown[] = [];
  images.forEach((b, i) => {
    content.push({ type: "text", text: `Billede ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b } });
  });
  content.push({
    type: "text",
    text:
      `Billederne er taget fra et live-videoshow, hvor en sælger viser en brugt ting frem: "${what}". ` +
      "Vælg det billede, der er bedst som produktbillede i en annonce for tingen: tingen skal kunne ses tydeligt, " +
      "være i fokus og gerne fylde meget. Sælgeren må godt være med, men billedet skal vise tingen. " +
      "Svar kun med billedets nummer. Svar 0, hvis tingen ikke kan ses på nogen af billederne.",
  });

  const base = (unquoteEnv(process.env.ANTHROPIC_API_BASE) || "https://api.anthropic.com").replace(/\/+$/, "");
  const model = unquoteEnv(process.env.ANTHROPIC_MODEL) || MODEL_DEFAULT;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const r = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      // Svaret er ét tal. max_tokens giver plads, hvis modellen tænker lidt først (kun tekstdelen bruges).
      body: JSON.stringify({ model, max_tokens: 400, messages: [{ role: "user", content }] }),
      signal: ctrl.signal,
    });
    const j = (await r.json().catch(() => null)) as { content?: { type: string; text?: string }[]; error?: { message?: string } } | null;
    if (!r.ok) {
      console.error("[relived] Claude svarede ikke på billedvalget:", r.status, j?.error?.message ?? "");
      return json({ pick: null, why: "error" });
    }
    const text = (j?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(" ");
    const m = /\d+/.exec(text);
    const n = m ? Number(m[0]) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > images.length) {
      console.error("[relived] uventet svar fra Claude på billedvalget:", text.slice(0, 80));
      return json({ pick: null, why: "unclear" });
    }
    return json({ pick: n });
  } catch (e) {
    console.error("[relived] Claude svarede ikke på billedvalget:", e instanceof Error ? e.message : e);
    return json({ pick: null, why: "error" });
  } finally {
    clearTimeout(timer);
  }
}
