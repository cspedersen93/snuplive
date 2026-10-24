import type { Metadata } from "next";
import Link from "next/link";
import CategoryCards from "@/components/CategoryCards";

export const metadata: Metadata = {
  title: { absolute: "Kategorier – brugt tøj, design og samleobjekter | Relived" },
  description:
    "Køb brugt dametøj, herretøj, børnetøj, design og samleobjekter live. Vælg en kategori, se tingene på video, og køb dem med ét tryk.",
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
          <h1 className="h1" id="h-kategorier">Køb brugt tøj, design og samleobjekter – vælg en kategori</h1>
        </div>
      </section>
      <section className="sec tight" aria-label="Alle kategorier">
        <div className="wrap">
          <CategoryCards headingLevel={2} />
          <p className="muted" style={{ marginTop: 24 }}>
            Passer tingen ikke ind? Se <Link href="/kategori/andet">andre brugte ting</Link>, eller se alt, der er{" "}
            <Link href="/til-salg">til salg lige nu</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
