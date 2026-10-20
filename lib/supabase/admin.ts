import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, hasSupabase, unquoteEnv } from "@/lib/env";

/**
 * Supabase med den hemmelige nøgle. Kun på serveren, og kun til ting som brugeren
 * ikke selv må gøre (fx at markere en ordre som betalt, når Stripe siger god for det).
 */
export function createAdminClient() {
  const key = unquoteEnv(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasSupabase || !key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
