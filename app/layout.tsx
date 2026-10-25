import "@fontsource-variable/familjen-grotesk";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import CookieNotice from "@/components/CookieNotice";
import SupportChat from "@/components/SupportChat";
import Toaster from "@/components/Toaster";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Relived – live shopping med brugt tøj og ting",
    template: "%s | Relived",
  },
  description:
    "Sælg og køb brugt tøj og ting live på video. Chat med sælgeren, køb med ét tryk og få det hele i én pakke. Prøv Relived.",
  applicationName: "Relived",
  openGraph: {
    type: "website",
    locale: "da_DK",
    siteName: "Relived",
    images: [{ url: "/img/og.jpg", width: 1200, height: 630, alt: "Live shopping med brugt tøj på Relived" }],
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0B0A0C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>
        {children}
        <SupportChat />
        <CookieNotice />
        <Toaster />
      </body>
    </html>
  );
}
