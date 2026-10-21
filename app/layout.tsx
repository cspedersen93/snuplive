import "@fontsource-variable/familjen-grotesk";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import BetaBar from "@/components/BetaBar";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Toaster from "@/components/Toaster";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SnupLive – live shopping med brugt tøj og ting",
    template: "%s | SnupLive",
  },
  description:
    "Sælg og køb brugt tøj og ting live på video. Chat med sælgeren, snup med ét tryk og få det hele i én pakke. Prøv SnupLive.",
  applicationName: "SnupLive",
  openGraph: {
    type: "website",
    locale: "da_DK",
    siteName: "SnupLive",
    images: [{ url: "/img/og.jpg", width: 1200, height: 630, alt: "Live shopping med brugt tøj på SnupLive" }],
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
        <BetaBar />
        <Header />
        <main id="indhold">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
