import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, hasSupabase } from "@/lib/env";

/**
 * Klient uden login til offentlige data (shows, profiler, chat) på server-sider,
 * der må caches. Returnerer null, hvis Supabase ikke er sat op endnu.
 */
export function createPublicClient() {
  if (!hasSupabase) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
