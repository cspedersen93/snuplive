import type { FeedItem } from "@/lib/types";

// Adresser til varesider: /ting/<navn>-<id>, fx /ting/le-klint-lampe-1f2e…

const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function itemSlug(item: { id: string; name: string }) {
  const s = slugify(item.name);
  return s ? `${s}-${item.id}` : item.id;
}

export const itemHref = (item: { id: string; name: string }) => `/ting/${itemSlug(item)}`;

export function idFromSlug(slug: string) {
  return UUID.exec(slug)?.[1]?.toLowerCase() ?? null;
}

/** Hvor er tingen lige nu? Bestemmer knappen på kortet og varesiden. */
export type ItemState = "upcoming" | "live" | "showing" | "for_sale" | "sold" | "off";

export function itemState(it: { status: string; for_sale: boolean; show_status: string }): ItemState {
  if (it.status === "sold") return "sold";
  if (it.show_status === "live") return it.status === "live" ? "showing" : "live";
  if (it.show_status === "planned") return "upcoming";
  return it.status === "unsold" && it.for_sale ? "for_sale" : "off";
}

export const feedTotal = (rows: FeedItem[]) => Number(rows[0]?.total ?? 0);
