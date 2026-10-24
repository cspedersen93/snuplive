import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { siteOpen } from "@/lib/siteAccess";

export const revalidate = 60;

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Før lanceringen: kun forsiden ("Kommer snart") og siderne om Relived.
  const rules = (await siteOpen())
    ? { userAgent: "*", allow: "/", disallow: ["/konto", "/kurv", "/studio", "/login", "/auth", "/api", "/admin"] }
    : { userAgent: "*", allow: ["/$", "/_next/", "/img/", "/om-relived", "/privatliv", "/handelsbetingelser", "/vilkaar"], disallow: "/" };
  return { rules, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
