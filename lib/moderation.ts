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
    if (!d) return { label: "en ting, der er slettet", href: null, owner: null, removed: true };
    return { label: `tingen "${d.name}"`, href: d.removed_at ? null : itemHref(d), owner: d.seller?.handle ?? null, removed: Boolean(d.removed_at) };
  }
  if (type === "show") {
    const { data } = await admin.from("shows").select("id,title,removed_at,seller:profiles!shows_seller_id_fkey(handle)").eq("id", id).maybeSingle();
    const d = data as unknown as { title: string; removed_at: string | null; seller: { handle: string } | null } | null;
    if (!d) return { label: "et show, der er slettet", href: null, owner: null, removed: true };
    const h = d.seller?.handle ?? null;
    return { label: `showet "${d.title}"`, href: h ? `/live/${h}` : null, owner: h, removed: Boolean(d.removed_at) };
  }
  const { data } = await admin.from("profiles").select("handle,is_seller").eq("id", id).maybeSingle();
  if (!data) return { label: "en profil, der er slettet", href: null, owner: null, removed: true };
  return { label: `profilen @${data.handle}`, href: `/live/${data.handle}`, owner: data.handle, removed: !data.is_seller };
}

/** Hvad sker der, når admin trykker "Fjern"? */
export const REMOVE_TEXT: Record<ReportTarget, { button: string; ask: string }> = {
  item: { button: "Fjern tingen", ask: "Tingen forsvinder fra SnupLive og kan ikke købes." },
  show: { button: "Fjern showet", ask: "Showet stopper og forsvinder sammen med tingene i det." },
  profile: { button: "Luk sælgerkontoen", ask: "Sælgeren kan ikke længere sælge, og kommende shows og ting forsvinder." },
};
