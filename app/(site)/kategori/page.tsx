import type { Metadata } from "next";
import Link from "next/link";
import CategoryCards from "@/components/CategoryCards";

export const metadata: Metadata = {
  title: { absolute: "Kategorier – køb second hand live på video | Relived" },
  description:
    "Find second hand i 9 kategorier: tøj, tasker, luksus, børn, cykler, bolig og samleobjekter. Se varerne live, og køb med ét tryk.",
  alternates: { canonical: "/kategori" },
};

export default function Kategorier() {
  return (
    <>
      <section className="phero" aria-labelledby="h-kategorier">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Kategorier</span>
          </nav>
          <h1 className="h1" id="h-kategorier">Køb second hand live – vælg en kategori</h1>
        </div>
      </section>
      <section className="sec tight" aria-label="Alle kategorier">
        <div className="wrap">
          <CategoryCards headingLevel={2} />
          <p className="muted" style={{ marginTop: 24 }}>
            Passer varen ikke ind? Se <Link href="/kategori/andet">andre brugte varer</Link>, eller se alt, der er{" "}
            <Link href="/til-salg">til salg lige nu</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
