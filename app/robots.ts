import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { siteOpen } from "@/lib/siteAccess";

// Skal følge kontakten "siden er åben" med det samme. Med en fast udløbstid blev filen hængende i dagevis,
// efter at siden var åbnet, og Google måtte kun se forsiden og guiderne.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Før lanceringen: kun forsiden ("Kommer snart") og siderne om Relived.
  const rules = (await siteOpen())
    ? { userAgent: "*", allow: "/", disallow: ["/konto", "/kurv", "/studio", "/login", "/auth", "/api", "/admin"] }
    : { userAgent: "*", allow: ["/$", "/_next/", "/img/", "/guides", "/om-relived", "/privatliv", "/cookies", "/handelsbetingelser", "/vilkaar"], disallow: "/" };
  return { rules, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
