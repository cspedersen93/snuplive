// Offentlige værdier (NEXT_PUBLIC_*) bliver bygget ind i siden. Hemmelige
// nøgler (LiveKit) læses kun i app/api/livekit-token på serveren.
//
// Værdierne bliver renset, så små fejl ved indtastning i Vercel (mellemrum,
// anførselstegn, manglende https://) ikke får hele siden til at fejle.

const unquote = (v: string | undefined) => (v ?? "").trim().replace(/^["']+|["']+$/g, "").trim();

/** Gør en indtastet adresse til en gyldig origin (fx https://abc.supabase.co), eller "" hvis den er ugyldig. */
export function cleanOrigin(raw: string | undefined, scheme = "https") {
  let v = unquote(raw);
  if (!v) return "";
  // Kun projekt-id'et (20 små bogstaver) er skrevet ind.
  if (scheme === "https" && /^[a-z]{20}$/.test(v)) return `https://${v}.supabase.co`;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `${scheme}://${v}`;
  try {
    const u = new URL(v);
    // Har man kopieret adressen på Supabase-dashboardet, finder vi projektets egen adresse.
    const ref = /^\/dashboard\/project\/([a-z0-9]+)/i.exec(u.pathname)?.[1];
    if (/(^|\.)supabase\.com$/i.test(u.hostname) && ref) return `https://${ref}.supabase.co`;
    // En rigtig adresse har et punktum i navnet (fx abc.supabase.co). Ellers er det nok en nøgle i det forkerte felt.
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return "";
    return u.origin;
  } catch {
    return "";
  }
}

export const SITE_URL = cleanOrigin(process.env.NEXT_PUBLIC_SITE_URL) || "https://snuplive.dk";

export const SUPABASE_URL = cleanOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_KEY = unquote(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** LiveKit-adressen som wss://… uanset om den er skrevet med https://, wss:// eller uden. */
export function livekitUrl(raw: string | undefined) {
  const o = cleanOrigin(raw, "wss");
  return o.replace(/^http(s?):\/\//i, (_m, s: string) => `ws${s}://`);
}

export const unquoteEnv = unquote;

/** Hvad der er galt med Supabase-opsætningen (uden at vise selve værdierne). */
export function supabaseSetupProblems() {
  const problems: string[] = [];
  const rawUrl = unquote(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const rawKey = unquote(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!rawUrl) problems.push("NEXT_PUBLIC_SUPABASE_URL mangler (eller er ikke slået til for Production).");
  else if (!SUPABASE_URL)
    problems.push(
      /^(sb_|eyJ)/.test(rawUrl)
        ? "NEXT_PUBLIC_SUPABASE_URL indeholder en nøgle. Den skal være din Project URL, fx https://abcd.supabase.co."
        : "NEXT_PUBLIC_SUPABASE_URL er ikke en gyldig adresse. Den skal ligne https://abcd.supabase.co.",
    );
  if (!rawKey) problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY mangler (eller er ikke slået til for Production).");
  else if (/^https?:\/\//i.test(rawKey) || rawKey.endsWith(".supabase.co"))
    problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY indeholder en adresse. Den skal være nøglen, der starter med sb_publishable_.");
  return problems;
}
