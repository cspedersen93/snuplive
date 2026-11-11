import type { SupabaseClient } from "@supabase/supabase-js";
import { itemHref } from "@/lib/items";
import type { ReportTarget } from "@/lib/reports";

export interface TargetInfo {
  /** Fx "tingen Le Klint-lampe" eller "profilen @maja". */
  label: string;
  href: string | null;
  owner: string | null;
  removed: boolean;
}

/** Hvad en anmeldelse handler om: navn, link og sælger. Kun til serveren (admin-klienten). */
export async function targetInfo(admin: SupabaseClient, type: ReportTarget, id: string): Promise<TargetInfo> {
  if (type === "item") {
    const { data } = await admin.from("items").select("id,name,removed_at,seller:profiles!items_seller_id_fkey(handle)").eq("id", id).maybeSingle();
    const d = data as unknown as { id: string; name: string; removed_at: string | null; seller: { handle: string } | null } | null;
    if (!d) return { label: "en vare, der er slettet", href: null, owner: null, removed: true };
    return { label: `varen "${d.name}"`, href: d.removed_at ? null : itemHref(d), owner: d.seller?.handle ?? null, removed: Boolean(d.removed_at) };
  }
  if (type === "show") {
    const { data } = await admin.from("shows").select("id,title,removed_at,seller:profiles!shows_seller_id_fkey(handle)").eq("id", id).maybeSingle();
    const d = data as unknown as { title: string; removed_at: string | null; seller: { handle: string } | null } | null;
    if (!d) return { label: "et show, der er slettet", href: null, owner: null, removed: true };
    const h = d.seller?.handle ?? null;
    return { label: `showet "${d.title}"`, href: h ? `/live/${h}` : null, owner: h, removed: Boolean(d.removed_at) };
  }
  if (type === "post") {
    // Opslag (0037_profil_opslag.sql).
    const { data } = await admin.from("posts").select("id,body,removed_at,seller:profiles!posts_seller_id_fkey(handle)").eq("id", id).maybeSingle();
    const d = data as unknown as { body: string; removed_at: string | null; seller: { handle: string } | null } | null;
    if (!d) return { label: "et opslag, der er slettet", href: null, owner: null, removed: true };
    const h = d.seller?.handle ?? null;
    const short = d.body.length > 40 ? `${d.body.slice(0, 40)}…` : d.body;
    return { label: `opslaget "${short}"`, href: h && !d.removed_at ? `/profil/${h}#opslag-${id}` : null, owner: h, removed: Boolean(d.removed_at) };
  }
  const { data } = await admin.from("profiles").select("handle,is_seller").eq("id", id).maybeSingle();
  if (!data) return { label: "en profil, der er slettet", href: null, owner: null, removed: true };
  return { label: `profilen @${data.handle}`, href: `/live/${data.handle}`, owner: data.handle, removed: !data.is_seller };
}

/** Hvad sker der, når admin trykker "Fjern"? */
export const REMOVE_TEXT: Record<ReportTarget, { button: string; ask: string }> = {
  item: { button: "Fjern varen", ask: "Varen forsvinder fra Relived og kan ikke købes." },
  show: { button: "Fjern showet", ask: "Showet stopper og forsvinder sammen med varerne i det." },
  profile: { button: "Luk sælgerkontoen", ask: "Sælgeren kan ikke længere sælge, og kommende shows og varer forsvinder." },
  post: { button: "Fjern opslaget", ask: "Opslaget forsvinder fra sælgerens profil og fra følgernes feed." },
};

/**
 * Admin afgør en anmeldelse af et opslag. Opslag ligger uden for admin_moderate() i databasen, så det sker her:
 * opslaget skjules (ved "remove"), og alle åbne anmeldelser af det bliver afgjort. Giver sælgerens id.
 */
export async function moderatePost(admin: SupabaseClient, postId: string, action: "remove" | "reject", decision: string) {
  if (action === "remove" && !decision) throw new Error("Skriv, hvorfor det bliver fjernet. Begrundelsen bliver sendt til sælgeren");
  const { data: post } = await admin.from("posts").select("id,seller_id").eq("id", postId).maybeSingle();
  const owner = (post as { seller_id: string } | null)?.seller_id ?? null;
  if (action === "remove") {
    if (!owner) throw new Error("Det anmeldte findes ikke længere");
    const { error } = await admin.from("posts").update({ removed_at: new Date().toISOString() }).eq("id", postId).is("removed_at", null);
    if (error) throw new Error(error.message);
  }
  const { error } = await admin
    .from("reports")
    .update({ status: action === "remove" ? "removed" : "rejected", decision: decision || null, decided_at: new Date().toISOString() })
    .eq("target_type", "post")
    .eq("target_id", postId)
    .eq("status", "open");
  if (error) throw new Error(error.message);
  return { owner_id: owner };
}
