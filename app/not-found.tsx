import type { Metadata } from "next";
import BetaBar from "@/components/BetaBar";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import NotFoundBody from "@/components/NotFoundBody";

export const metadata: Metadata = { title: "Siden findes ikke", robots: { index: false } };

/** En adresse, der ikke findes: her er der ingen ramme omkring, så topbjælke og bund kommer med her. */
export default function NotFound() {
  return (
    <>
      <BetaBar />
      <Header />
      <main id="indhold">
        <NotFoundBody />
      </main>
      <Footer />
    </>
  );
}
