import { SUPABASE_URL } from "@/lib/env";
import { category } from "@/lib/format";

/** Offentlig adresse til et billede i Supabase Storage. */
export function storageUrl(bucket: "avatars" | "covers", path: string, version?: string | null) {
  const v = version ? `?v=${encodeURIComponent(new Date(version).getTime().toString(36))}` : "";
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}${v}`;
}

export function avatarUrl(path?: string | null) {
  return path ? storageUrl("avatars", path) : null;
}

/**
 * Billedet til et show: et frisk billede fra kameraet, mens showet er live,
 * ellers sælgerens profilbillede, ellers kategoriens billede.
 */
export function showImage(show: {
  status: string;
  category: string;
  cover_path?: string | null;
  cover_at?: string | null;
  seller?: { avatar_path?: string | null } | null;
}) {
  if (show.status === "live" && show.cover_path) return storageUrl("covers", show.cover_path, show.cover_at);
  if (show.seller?.avatar_path) return storageUrl("avatars", show.seller.avatar_path);
  return category(show.category).cover;
}
