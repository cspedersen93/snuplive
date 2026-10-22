import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { CATEGORIES } from "@/lib/format";
import { itemHref } from "@/lib/items";
import { fetchFeed } from "@/lib/queries";
import { siteOpen } from "@/lib/siteAccess";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  // Før lanceringen kan Google kun se "Kommer snart" og de faste sider om SnupLive.
  if (!(await siteOpen())) {
    return [
      { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
      ...["/om-snuplive", "/privatliv", "/handelsbetingelser", "/vilkaar"].map((p) => ({
        url: `${SITE_URL}${p}`,
        lastModified: now,
        changeFrequency: "yearly" as const,
        priority: 0.2,
      })),
    ];
  }
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/live`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/til-salg`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/kategori`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...CATEGORIES.map((c) => ({
      url: `${SITE_URL}/kategori/${c.slug}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: c.key === "andet" ? 0.5 : 0.8,
    })),
    { url: `${SITE_URL}/saelg`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/saadan-virker-det`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/opret`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/privatliv`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/handelsbetingelser`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/vilkaar`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/om-snuplive`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
  const sb = createPublicClient();
  if (!sb) return pages;
  try {
    // Sælgersider med shows, så Google kan finde dem.
    const { data } = await sb
      .from("shows")
      .select("created_at,seller:profiles!shows_seller_id_fkey(handle)")
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(2000);
    const seen = new Set<string>();
    for (const row of (data ?? []) as unknown as { created_at: string; seller: { handle: string } | null }[]) {
      const h = row.seller?.handle;
      if (!h || seen.has(h)) continue;
      seen.add(h);
      pages.push({ url: `${SITE_URL}/live/${h}`, lastModified: new Date(row.created_at), changeFrequency: "daily", priority: 0.6 });
    }
    // Ting, der kan købes nu eller bliver vist snart. Solgte ting er ikke med.
    for (const kind of ["for_sale", "upcoming"] as const) {
      for (let page = 0; page < 20; page++) {
        const rows = await fetchFeed(kind, { limit: 100, offset: page * 100 });
        for (const it of rows) {
          pages.push({
            url: `${SITE_URL}${itemHref(it)}`,
            lastModified: it.listed_at ? new Date(it.listed_at) : now,
            changeFrequency: "daily",
            priority: 0.5,
          });
        }
        if (rows.length < 100) break;
      }
    }
  } catch {
    // Databasen svarer ikke: send de faste sider.
  }
  return pages;
}
