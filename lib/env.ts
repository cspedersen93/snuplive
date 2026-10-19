// Offentlige værdier (NEXT_PUBLIC_*) bliver bygget ind i siden. Hemmelige
// nøgler (LiveKit) læses kun i app/api/livekit-token på serveren.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://snuplive.dk").replace(/\/$/, "");

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
