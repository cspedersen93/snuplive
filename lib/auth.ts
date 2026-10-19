import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Kræver login. Sender brugeren til /login og tilbage igen bagefter. */
export async function requireProfile(next: string) {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data } = await supabase
    .from("profiles")
    .select("id,handle,display_name,area,is_seller")
    .eq("id", uid)
    .maybeSingle();
  if (!data) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, uid, profile: data as Profile };
}
