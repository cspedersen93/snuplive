import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/live`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/saelg`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/saadan-virker-det`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/opret`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/privatliv`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
  const sb = createPublicClient();
  if (!sb) return pages;
  try {
    // Sælgersider med shows, så Google kan finde dem.
    const { data } = await sb
      .from("shows")
      .select("created_at,seller:profiles!shows_seller_id_fkey(handle)")
      .order("created_at", { ascending: false })
      .limit(2000);
    const seen = new Set<string>();
    for (const row of (data ?? []) as unknown as { created_at: string; seller: { handle: string } | null }[]) {
      const h = row.seller?.handle;
      if (!h || seen.has(h)) continue;
      seen.add(h);
      pages.push({ url: `${SITE_URL}/live/${h}`, lastModified: new Date(row.created_at), changeFrequency: "daily", priority: 0.6 });
    }
  } catch {
    // Databasen svarer ikke: send de faste sider.
  }
  return pages;
}
