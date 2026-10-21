import type { Metadata } from "next";
import Link from "next/link";
import CategoryCards from "@/components/CategoryCards";
import ItemCard from "@/components/ItemCard";
import PhoneMock from "@/components/PhoneMock";
import ShowCard from "@/components/ShowCard";
import type { FeedItem } from "@/lib/types";
import { SITE_URL } from "@/lib/env";
import { DELIVERY } from "@/lib/pricing";
import { fetchFeed, fetchListing } from "@/lib/queries";

export const revalidate = 30;

export const metadata: Metadata = {
  title: { absolute: "Second hand live-salg: tøj, design og samleobjekter" },
  description:
    "Køb brugt tøj, børnetøj, design og samleobjekter live. Se tingen på video, spørg i chatten, og snup den med ét tryk. Betalingen er beskyttet.",
  openGraph: { title: "Køb live – second hand: tøj, design og samleobjekter" },
  alternates: { canonical: "/" },
};

export default async function Forside() {
  const [{ live, upcoming }, upcomingItems, auctions, forSale] = await Promise.all([
    fetchListing(10, 10),
    fetchFeed("upcoming", { limit: 20 }),
    fetchFeed("auctions", { limit: 10 }),
    fetchFeed("for_sale", { limit: 10 }),
  ]);
  // Ting på budsalg har deres egen række, så de ikke står to gange.
  const soon = upcomingItems.filter((it) => it.sale_type !== "auction").slice(0, 10);
  const shows = [...live, ...upcoming].slice(0, 10);

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "SnupLive", url: `${SITE_URL}/`, logo: `${SITE_URL}/img/logo.png` },
      { "@type": "WebSite", name: "SnupLive", url: `${SITE_URL}/`, inLanguage: "da-DK" },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="hero" aria-labelledby="h-forside">
        <div className="wrap">
          <div className="hero-copy">
            <span className="eyebrow label">
              <span className="live-dot" aria-hidden="true" />
              {live.length ? `${live.length} ${live.length === 1 ? "sælger er" : "sælgere er"} live nu` : "Brugt tøj og ting på video"}
            </span>
            <h1 id="h-forside" className="hero-h1">
              Køb <em className="s">live</em> – second hand: tøj, design og samleobjekter
            </h1>
            <p className="lede">Se tingen på video, spørg i chatten, og snup den med ét tryk.</p>
            <div className="ctas">
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
              <Link className="btn btn-line" href="/til-salg">Køb nu til fast pris</Link>
            </div>
            <ul className="points">
              <li>Beskyttet betaling</li>
              <li>Fragt {DELIVERY.ship.price} kr til pakkeshop</li>
            </ul>
          </div>
          <PhoneMock />
        </div>
      </section>

      <section className="sec tight" aria-labelledby="h-live-now">
        <div className="wrap">
          <div className="row-head">
            <h2 className="h2" id="h-live-now">
              Hvem er <em className="s">live</em> lige nu?
            </h2>
            <Link className="btn btn-line" href="/live">Se alle shows</Link>
          </div>
          {shows.length ? (
            <div className="cards-scroll">
              <div className="cards">
                {shows.map((s, i) => (
                  <ShowCard key={s.id} show={s} priority={i < 2} />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty">
              <p style={{ marginBottom: 14 }}>Ingen er live lige nu. Kig forbi i aften, eller se hvad der er til salg.</p>
              <Link className="btn btn-red" href="/til-salg">Se ting til salg</Link>
            </div>
          )}
        </div>
      </section>

      <section className="sec tight" aria-labelledby="h-kategorier">
        <div className="wrap">
          <div className="row-head">
            <h2 className="h2" id="h-kategorier">Hvad kan du købe brugt på SnupLive?</h2>
            <Link className="btn btn-line" href="/kategori">Alle kategorier</Link>
          </div>
          <CategoryCards />
        </div>
      </section>

      <ItemRow id="h-budsalg" title="Kommende budsalg – byd live" items={auctions} link={{ href: "/live", label: "Se programmet" }} />
      <ItemRow id="h-snart" title="Snart i et live-show" items={soon} link={{ href: "/live", label: "Se programmet" }} />
      <ItemRow id="h-til-salg" title="Til salg nu – fundet i tidligere shows" items={forSale} link={{ href: "/til-salg", label: "Se alt til salg" }} />

      <section className="sec band" aria-labelledby="h-how">
        <div className="wrap split">
          <figure className="photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/s-setup.jpg" alt="En sælger holder en kjole op foran en telefon på stativ med ringlys" loading="lazy" width={1200} height={800} />
            <figcaption>
              <span className="live-dot" aria-hidden="true" />
              Live fra soveværelset
            </figcaption>
          </figure>
          <div>
            <h2 className="h2" id="h-how" style={{ marginBottom: 24 }}>Hvordan køber man brugt live?</h2>
            <ol className="steps">
              <li><div><h3>Find et show eller en ting</h3><p>Se hvem der er live, eller tryk Husk mig.</p></div></li>
              <li><div><h3>Se den tæt på, og spørg</h3><p>Sælgeren viser mærke, mål og slid på video.</p></div></li>
              <li><div><h3>Snup eller byd</h3><p>Du betaler samlet, og alt fra samme sælger kommer i én pakke.</p></div></li>
            </ol>
            <div className="ctas" style={{ marginTop: 28 }}>
              <Link className="btn btn-red" href="/live">Find et show</Link>
              <Link className="btn btn-line" href="/saadan-virker-det">Sådan virker det</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-saelg">
        <div className="wrap">
          <article className="panel img sell-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/s-phone.jpg" alt="Telefon på stativ med ringlys viser en sælger, der er live" loading="lazy" />
            <span className="label red">Til sælgere</span>
            <h2 className="h2" id="h-saelg" style={{ maxWidth: "16ch" }}>Har du selv noget, der skal videre?</h2>
            <p style={{ maxWidth: 520, color: "rgba(246,240,235,.88)" }}>Gå live fra stuen, og sælg en hel bunke på én aften.</p>
            <Link className="btn btn-red" href="/saelg">Sådan sælger du live</Link>
          </article>
        </div>
      </section>
    </>
  );
}

/** En vandret række med ting (forsiden). Vises ikke, når der ikke er noget. */
function ItemRow({ id, title, items, link }: { id: string; title: string; items: FeedItem[]; link: { href: string; label: string } }) {
  if (!items.length) return null;
  return (
    <section className="sec tight" aria-labelledby={id}>
      <div className="wrap">
        <div className="row-head">
          <h2 className="h2" id={id}>{title}</h2>
          <Link className="btn btn-line" href={link.href}>{link.label}</Link>
        </div>
        <div className="icards-scroll" style={{ "--n": items.length } as React.CSSProperties}>
          <div className="icards">
            {items.map((it) => (
              <ItemCard key={it.id} item={it} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
