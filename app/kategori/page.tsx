import type { Metadata } from "next";
import Link from "next/link";
import CategoryCards from "@/components/CategoryCards";

export const metadata: Metadata = {
  title: { absolute: "Kategorier – brugt tøj, design og samlerting | SnupLive" },
  description:
    "Køb brugt dametøj, herretøj, børnetøj, design og samlerting live. Vælg en kategori, se tingene på video, og snup dem med ét tryk.",
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
          <span className="label">Fem kategorier</span>
          <h1 className="h1" id="h-kategorier">Køb brugt tøj, design og samlerting – vælg en kategori</h1>
          <p className="lede">
            Vælg en kategori, og se hvem der er live, hvad der bliver vist snart, og hvad du kan købe med det samme.
          </p>
        </div>
      </section>
      <section className="sec tight" aria-label="Alle kategorier">
        <div className="wrap">
          <CategoryCards headingLevel={2} />
          <p className="muted" style={{ marginTop: 24 }}>
            Passer tingen ikke ind? Se <Link href="/kategori/andet">andre brugte ting</Link>, eller se alt, der er{" "}
            <Link href="/til-salg">til salg lige nu</Link>.
          </p>
          <div className="ctas" style={{ marginTop: 20 }}>
            <Link className="btn btn-red" href="/til-salg">Se alt til salg</Link>
            <Link className="btn btn-line" href="/live">Se hvem der er live</Link>
          </div>
        </div>
      </section>
    </>
  );
}
