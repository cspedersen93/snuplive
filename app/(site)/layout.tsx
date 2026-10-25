import BetaBar from "@/components/BetaBar";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

// De faste sider (FAQ, vilkår osv.) laves nye mindst hvert minut, så TESTFASE-bjælken følger med, når den slås til
// eller fra i Backoffice. Sider, der selv er hurtigere eller altid friske, er ikke berørt.
export const revalidate = 60;

/** Hele siden: topbjælke, menu og bund. "Kommer snart" har sit eget, enklere layout. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BetaBar />
      <Header />
      <main id="indhold">{children}</main>
      <Footer />
    </>
  );
}
