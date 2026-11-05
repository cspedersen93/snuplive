import { unquoteEnv } from "@/lib/env";

// Kald til Claude (Anthropic) fra serveren: billedvalget, "AI skriver annoncen" og nyhedsbrevet i Backoffice.
// Uden ANTHROPIC_API_KEY er Claude slået fra, og siden virker som før (sælgeren vælger og skriver selv).

const MODEL_DEFAULT = "claude-haiku-5-5";

/** Er Claude sat op? */
export function aiConfigured() {
  return Boolean(unquoteEnv(process.env.ANTHROPIC_API_KEY));
}

/** Bremse mod mange kald fra samme sælger på kort tid (pr. server, nok til at stoppe et løbsk script). */
export function rateLimiter(max: number, windowMs: number) {
  const recent = new Map<string, number[]>();
  return (uid: string) => {
    const now = Date.now();
    const list = (recent.get(uid) ?? []).filter((t) => now - t < windowMs);
    list.push(now);
    recent.set(uid, list);
    if (recent.size > 5000) recent.clear();
    return list.length > max;
  };
}

/** Billeder som base64-JPEG: tjek antal og størrelse, før de sendes videre. */
export function validImages(images: unknown, max: number, maxB64 = 300_000): images is string[] {
  return (
    Array.isArray(images) &&
    images.length > 0 &&
    images.length <= max &&
    images.every((b) => typeof b === "string" && b.length > 100 && b.length <= maxB64 && /^[A-Za-z0-9+/=]+$/.test(b))
  );
}

/** Spørg Claude om billederne. Giver svarteksten, eller hvorfor der ikke kom et svar. */
export async function askClaude(
  images: string[],
  question: string,
  opts: { maxTokens?: number; label?: string; timeoutMs?: number; model?: string } = {},
): Promise<{ text: string } | { why: "off" | "error" }> {
  const key = unquoteEnv(process.env.ANTHROPIC_API_KEY);
  if (!key) return { why: "off" };
  const label = opts.label ?? "billedvalget";
  const content: unknown[] = [];
  images.forEach((b, i) => {
    content.push({ type: "text", text: `Billede ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b } });
  });
  content.push({ type: "text", text: question });

  const base = (unquoteEnv(process.env.ANTHROPIC_API_BASE) || "https://api.anthropic.com").replace(/\/+$/, "");
  const model = opts.model || unquoteEnv(process.env.ANTHROPIC_MODEL) || MODEL_DEFAULT;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const r = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      // max_tokens giver plads, hvis modellen tænker lidt først (kun tekstdelen bruges).
      body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 400, messages: [{ role: "user", content }] }),
      signal: ctrl.signal,
    });
    const j = (await r.json().catch(() => null)) as { content?: { type: string; text?: string }[]; error?: { message?: string } } | null;
    if (!r.ok) {
      console.error(`[relived] Claude svarede ikke på ${label}:`, r.status, j?.error?.message ?? "");
      return { why: "error" };
    }
    return { text: (j?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(" ") };
  } catch (e) {
    console.error(`[relived] Claude svarede ikke på ${label}:`, e instanceof Error ? e.message : e);
    return { why: "error" };
  } finally {
    clearTimeout(timer);
  }
}
