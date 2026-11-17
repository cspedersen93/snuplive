// Delebilledet (når et link til Relived deles på Facebook og lignende). Sider, der sætter deres egne Open Graph-felter,
// skal også have billedet med, ellers forsvinder det (Next.js erstatter hele openGraph fra layoutet).
export const OG_IMAGE = {
  url: "/img/og-v2.jpg",
  width: 1200,
  height: 630,
  alt: "Relived: køb og sælg second hand live på video",
};

/**
 * Open Graph-felter til en side. Next.js erstatter hele openGraph fra layoutet, når en side sætter sine egne felter,
 * så type, sprog, navn og billede skal med hver gang. `path` er sidens egen adresse ("/saelg"), så delinger af samme
 * side tælles sammen.
 */
export function og(path: string, extra: Record<string, unknown> = {}) {
  return { type: "website" as const, locale: "da_DK", siteName: "Relived", url: path, images: [OG_IMAGE], ...extra };
}
