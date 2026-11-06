import type { MetadataRoute } from "next";

/**
 * Relived som app på hjemmeskærmen (og besked på iPhone). Genvejene står, når man holder fingeren på ikonet
 * (Android og computer). Se også public/sw.js og components/app/.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Relived",
    short_name: "Relived",
    description: "Live shopping med brugte varer. Se varen live, spørg i chatten, og køb med ét tryk.",
    lang: "da",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#19181B",
    theme_color: "#19181B",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Live nu", short_name: "Live", description: "Se, hvem der er live lige nu", url: "/live", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Budsalg", description: "Varer på budsalg i de næste shows", url: "/budsalg", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Søg", description: "Søg i varer, shows og sælgere", url: "/soeg", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Sælg", description: "Sælg dine varer live", url: "/saelg", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
