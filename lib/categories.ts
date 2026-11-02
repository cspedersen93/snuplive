import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kategorier, der ikke kan vælges endnu, fordi deres fil ikke er kørt i Supabase.
 * Cykler og barnevogne kræver 0029_cykler.sql. Uden den bliver kategorien skjult i formularerne.
 */
export async function hiddenCategories(sb: SupabaseClient | null): Promise<string[]> {
  if (!sb) return ["cykler"];
  const { data, error } = await sb.rpc("category_ready", { p_key: "cykler" });
  return !error && data === true ? [] : ["cykler"];
}
