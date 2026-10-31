import type { MetadataRoute } from "next";

/** Gør det muligt at lægge Relived på hjemmeskærmen (og få besked på iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Relived",
    short_name: "Relived",
    description: "Live shopping med brugte varer. Se varen live, spørg i chatten, og køb med ét tryk.",
    lang: "da",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0B0A0C",
    theme_color: "#0B0A0C",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
