import BetaBar from "@/components/BetaBar";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import SearchAlertsSweep from "@/components/SearchAlertsSweep";
import AppShell from "@/components/shell/AppShell";
import ShellProvider from "@/components/shell/ShellContext";
import { launched } from "@/lib/launch";

// De faste sider (FAQ, vilkår osv.) laves nye mindst hvert minut, så TESTFASE-bjælken følger med, når den slås til
// eller fra i Backoffice. Sider, der selv er hurtigere eller altid friske, er ikke berørt.
export const revalidate = 60;

/**
 * Hele siden i app-rammen: menu i venstre side (computer), topbjælke, siden og bund, og menulinjen i bunden
 * (telefon). "Kommer snart" har sit eget, enklere layout.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <BetaBar />
      <AppShell launched={launched()}>
        <Header />
        <main id="indhold">{children}</main>
        <Footer />
      </AppShell>
      <SearchAlertsSweep />
    </ShellProvider>
  );
}
