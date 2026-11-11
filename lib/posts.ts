// Sælgerprofilen (tekst og forsidebillede) og opslag. Se supabase/migrations/0037_profil_opslag.sql.
// Alt her tåler, at filen ikke er kørt endnu: så er der bare ingen tekst, intet forsidebillede og ingen opslag.
import type { SupabaseClient } from "@supabase/supabase-js";

export const POST_MAX = 600;
export const POST_IMAGES_MAX = 4;
export const BIO_MAX = 300;

export interface Post {
  id: string;
  seller_id: string;
  body: string;
  images: string[];
  show_id: string | null;
  created_at: string;
  seller: { handle: string; avatar_path: string | null } | null;
  show: { id: string; title: string; status: string; starts_at: string | null; removed_at: string | null } | null;
}

const POST_SELECT =
  "id,seller_id,body,images,show_id,created_at,seller:profiles!posts_seller_id_fkey(handle,avatar_path),show:shows!posts_show_id_fkey(id,title,status,starts_at,removed_at)";

export interface ProfileExtra {
  bio: string | null;
  cover_path: string | null;
}

/** Teksten og forsidebilledet på profilen. null betyder, at 0037 ikke er kørt endnu. */
export async function fetchProfileExtra(sb: SupabaseClient, id: string): Promise<ProfileExtra | null> {
  const { data, error } = await sb.from("profiles").select("bio,cover_path").eq("id", id).maybeSingle();
  if (error) return null;
  const d = data as ProfileExtra | null;
  return { bio: d?.bio ?? null, cover_path: d?.cover_path ?? null };
}

/** De nyeste opslag fra én sælger eller fra en liste af sælgere. null betyder, at 0037 ikke er kørt endnu. */
export async function fetchPosts(sb: SupabaseClient, opts: { seller?: string; sellers?: string[]; limit?: number }): Promise<Post[] | null> {
  if (opts.sellers && !opts.sellers.length) {
    // Er tabellen der? Så kan siden skelne "følger ingen" fra "ikke klar endnu".
    const probe = await sb.from("posts").select("id").limit(1);
    return probe.error ? null : [];
  }
  let q = sb.from("posts").select(POST_SELECT).is("removed_at", null).order("created_at", { ascending: false }).limit(opts.limit ?? 20);
  if (opts.seller) q = q.eq("seller_id", opts.seller);
  if (opts.sellers) q = q.in("seller_id", opts.sellers);
  const { data, error } = await q;
  if (error) return null;
  return ((data ?? []) as unknown as Post[]).map((p) => ({ ...p, images: p.images ?? [], show: p.show && !p.show.removed_at ? p.show : null }));
}

/** "for 3 timer siden", "i går", ellers datoen. */
export function postAge(iso: string, now = Date.now()) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "lige nu";
  if (min < 60) return `for ${min} min. siden`;
  const h = Math.round(min / 60);
  if (h < 24) return `for ${h} ${h === 1 ? "time" : "timer"} siden`;
  const d = Math.round(h / 24);
  if (d === 1) return "i går";
  if (d < 7) return `for ${d} dage siden`;
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "long", timeZone: "Europe/Copenhagen" });
}
