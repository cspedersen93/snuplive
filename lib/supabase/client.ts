"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/** Supabase-klient i browseren (én pr. fane). */
export function getSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
