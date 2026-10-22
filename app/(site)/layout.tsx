import BetaBar from "@/components/BetaBar";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

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
