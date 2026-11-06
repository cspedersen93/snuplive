import "@fontsource-variable/familjen-grotesk";
import { OG_IMAGE } from "@/lib/og";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import CookieNotice from "@/components/CookieNotice";
import SiteAnalytics from "@/components/SiteAnalytics";
import SupportChat from "@/components/SupportChat";
import Toaster from "@/components/Toaster";
import AppSetup from "@/components/app/AppSetup";
import { SITE_URL } from "@/lib/env";
import { APPLE_STARTUP } from "@/lib/splash";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Relived – køb og sælg second hand live på video",
    template: "%s | Relived",
  },
  description:
    "Køb og sælg brugte varer, ubrugte fejlkøb og restpartier live på video. Se varen, før du køber, spørg sælgeren, og køb med ét tryk.",
  applicationName: "Relived",
  // Når Relived er lagt på hjemmeskærmen på iPhone: navnet under ikonet, sort statuslinje og startskærm med logoet.
  appleWebApp: { capable: true, title: "Relived", statusBarStyle: "black", startupImage: APPLE_STARTUP },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "da_DK",
    siteName: "Relived",
    images: [OG_IMAGE],
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#141316",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head>
        {/* Gemmer browserens tilbud om at installere appen, hvis det kommer, før siden er klar (lib/appInstall.ts). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__rlvPrompt=e;});",
          }}
        />
      </head>
      <body>
        <AppSetup />
        {children}
        <SupportChat />
        <CookieNotice />
        <Toaster />
        {/* Statistik over besøg (uden cookies). Kun på Vercel, ikke lokalt eller i test. */}
        {process.env.VERCEL ? <SiteAnalytics /> : null}
      </body>
    </html>
  );
}
