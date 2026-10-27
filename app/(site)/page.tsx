import type { Metadata } from "next";
import Link from "next/link";
import { IconPlay } from "@/components/Icons";
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
  title: { absolute: "Køb og sælg second hand live på video | Relived" },
  description:
    "Køb second hand live: se tøjet, tasken eller lampen på video, spørg sælgeren i chatten, og køb med ét tryk. Sælgeren får først pengene, når du har tingen.",
  openGraph: { title: "Second hand, du kan se live, før du køber" },
  alternates: { canonical: "/", languages: { "da-DK": "/", en: "/en" } },
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
      { "@type": "Organization", name: "Relived", url: `${SITE_URL}/`, logo: `${SITE_URL}/img/logo.png` },
      { "@type": "WebSite", name: "Relived", url: `${SITE_URL}/`, inLanguage: "da-DK" },
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
              {live.length ? `${live.length} ${live.length === 1 ? "sælger er" : "sælgere er"} live nu` : "Live Sale. Second Hand."}
            </span>
            <h1 id="h-forside" className="hero-h1">
              Second hand, du kan se <em className="s">live</em>, før du køber
            </h1>
            <p className="lede">
              Sælgeren viser tingen frem på video, du spørger løs i chatten, og den første, der trykker Køb, får den. Ingen slørede
              billeder og ingen »Er den stadig til salg?«.
            </p>
            <div className="ctas">
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
              <Link className="btn btn-line" href="/til-salg">Køb til fast pris</Link>
            </div>
            <ul className="points">
              <li>Sælgeren får først pengene, når du har tingen</li>
              <li>Fragt {DELIVERY.ship.price} kr til pakkeshop</li>
              <li>Ingen app at hente</li>
            </ul>
          </div>
          <PhoneMock />
        </div>
      </section>

      <section className="sec tight" aria-labelledby="h-kategorier">
        <div className="wrap">
          <div className="row-head">
            <h2 className="h2" id="h-kategorier">Hvad kan du købe brugt på Relived?</h2>
            <Link className="btn btn-line" href="/kategori">Alle kategorier</Link>
          </div>
          <CategoryCards />
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
              <p style={{ marginBottom: 14 }}>
                Ingen er live lige nu. Tryk Husk mig på et show, der starter senere, eller køb noget af det, der allerede er vist frem
                på video.
              </p>
              <Link className="btn btn-red" href="/til-salg">Se ting til salg</Link>
            </div>
          )}
        </div>
      </section>

      <ItemRow id="h-budsalg" title="Kommende budsalg – byd med live" items={auctions} link={{ href: "/live", label: "Se programmet" }} />
      <ItemRow id="h-snart" title="Snart i et live-show" items={soon} link={{ href: "/live", label: "Se programmet" }} />
      <ItemRow
        id="h-til-salg"
        title="Til salg nu – køb til fast pris"
        items={forSale}
        link={{ href: "/til-salg", label: "Se alt til salg" }}
        extra={forSale.some((i) => i.clip_path) ? { href: "/klip", label: "Swipe gennem klip" } : undefined}
      />

      <section className="sec band" aria-labelledby="h-how">
        <div className="wrap split">
          <figure className="photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/how-live.jpg" alt="En sælger holder en skjorte op foran ringlyset og telefonen" loading="lazy" width={1500} height={1000} />
            <figcaption>
              <span className="live-dot" aria-hidden="true" />
              Live fra soveværelset
            </figcaption>
          </figure>
          <div>
            <h2 className="h2" id="h-how" style={{ marginBottom: 24 }}>Hvordan køber man brugt live?</h2>
            <ol className="steps">
              <li><div><h3>Find et show eller en ting</h3><p>Se, hvem der er live, eller tryk Husk mig på et show, der starter senere. Så giver vi dig besked.</p></div></li>
              <li><div><h3>Se den tæt på, og spørg</h3><p>Bed sælgeren vise mærket, målene og slid tæt på. Du får svar, mens du ser med.</p></div></li>
              <li><div><h3>Køb eller byd</h3><p>Tryk Køb, eller byd med på budsalg. Du betaler samlet bagefter, og alt fra samme sælger kommer i én pakke.</p></div></li>
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
            <img src="/img/sell-phone.jpg" alt="Telefon på stativ med ringlys filmer en sælger, der viser en kjole" loading="lazy" />
            <span className="label red">Til sælgere</span>
            <h2 className="h2" id="h-saelg" style={{ maxWidth: "16ch" }}>Har du selv noget, der skal videre?</h2>
            <p style={{ maxWidth: 520, color: "rgba(246,240,235,.88)" }}>
              Gå live fra stuen, og sælg en hel bunke på én aften i stedet for at lægge annoncer op én ad gangen. Det er gratis at
              sælge, mens vi er i beta.
            </p>
            <Link className="btn btn-red" href="/saelg">Sådan sælger du live</Link>
          </article>
        </div>
      </section>
    </>
  );
}

/** En vandret række med ting (forsiden). Vises ikke, når der ikke er noget. */
function ItemRow({
  id,
  title,
  items,
  link,
  extra,
}: {
  id: string;
  title: string;
  items: FeedItem[];
  link: { href: string; label: string };
  extra?: { href: string; label: string };
}) {
  if (!items.length) return null;
  return (
    <section className="sec tight" aria-labelledby={id}>
      <div className="wrap">
        <div className="row-head">
          <h2 className="h2" id={id}>{title}</h2>
          {extra ? (
            <div className="row-head-btns">
              <Link className="btn btn-red" href={extra.href}>
                <IconPlay width={14} height={14} />
                {extra.label}
              </Link>
              <Link className="btn btn-line" href={link.href}>{link.label}</Link>
            </div>
          ) : (
            <Link className="btn btn-line" href={link.href}>{link.label}</Link>
          )}
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
