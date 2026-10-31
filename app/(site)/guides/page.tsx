import type { Metadata } from "next";
import Link from "next/link";
import GuideCards from "@/components/GuideCards";
import { SITE_URL } from "@/lib/env";
import { GUIDES, guideHref } from "@/lib/guides";

export const metadata: Metadata = {
  title: { absolute: "Guides: køb og sælg brugt tøj og design | Relived" },
  description:
    "Gode råd til at købe og sælge brugt: sæt den rigtige pris, sælg live, tjek om en designertaske er ægte, og se reglerne for skat ved salg af brugt tøj.",
  alternates: { canonical: "/guides" },
};

export default function Guides() {
  const sellers = GUIDES.filter((g) => g.audience === "Sælger");
  const buyers = GUIDES.filter((g) => g.audience !== "Sælger");
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Guides til køb og salg af brugt",
        url: `${SITE_URL}/guides`,
        inLanguage: "da-DK",
        hasPart: GUIDES.map((g) => ({ "@type": "Article", headline: g.h1, url: `${SITE_URL}${guideHref(g)}` })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Forside", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="phero" aria-labelledby="h-guides">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Guides</span>
          </nav>
          <span className="label red">Guides</span>
          <h1 className="h1" id="h-guides">Guides til at købe og sælge brugt tøj og design</h1>
          <p className="lede">
            Hvad skal brugt tøj koste? Er tasken ægte? Skal du betale skat? Her er svarene og de bedste råd til at købe og sælge
            brugt, skrevet så de er lige til at bruge.
          </p>
        </div>
      </section>

      <section className="sec tight" aria-labelledby="h-guides-saelg">
        <div className="wrap">
          <div className="row-head">
            <h2 className="h3" id="h-guides-saelg">Til dig, der vil sælge</h2>
            <Link className="linkbtn" href="/saelg">Sådan sælger du på Relived</Link>
          </div>
          <GuideCards guides={sellers} four />
        </div>
      </section>

      <section className="sec tight" style={{ paddingTop: 0 }} aria-labelledby="h-guides-koeb">
        <div className="wrap">
          <div className="row-head">
            <h2 className="h3" id="h-guides-koeb">Til dig, der vil købe</h2>
            <Link className="linkbtn" href="/saadan-virker-det">Sådan virker det</Link>
          </div>
          <GuideCards guides={buyers} four />
        </div>
      </section>

      <section className="sec tight" style={{ paddingTop: 0 }} aria-labelledby="h-guides-cta">
        <div className="wrap">
          <div className="cta-band">
            <div>
              <h2 className="h2" id="h-guides-cta">Prøv det selv</h2>
              <p className="lede" style={{ marginTop: 12 }}>Se brugt tøj og design live på video, eller sælg dit eget. Det er gratis i beta.</p>
            </div>
            <div className="ctas">
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
              <Link className="btn btn-line" href="/saelg">Bliv sælger</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
