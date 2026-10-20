import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryIcon from "@/components/CategoryIcon";
import ItemCard from "@/components/ItemCard";
import ShowCard from "@/components/ShowCard";
import { CATEGORIES, categoryBySlug } from "@/lib/format";
import { feedTotal } from "@/lib/items";
import { fetchFeed, fetchListing } from "@/lib/queries";

export const revalidate = 30;

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const cat = categoryBySlug((await params).slug);
  if (!cat) return { title: "Kategorien findes ikke", robots: { index: false } };
  return {
    title: { absolute: cat.title },
    description: cat.description,
    alternates: { canonical: `/kategori/${cat.slug}` },
    openGraph: { images: [cat.cover] },
  };
}

const FOR_SALE = 20;

export default async function Kategori({ params }: Params) {
  const cat = categoryBySlug((await params).slug);
  if (!cat) notFound();

  const [{ live, upcoming }, soon, forSale] = await Promise.all([
    fetchListing(10, 10, cat.key),
    fetchFeed("upcoming", { category: cat.key, limit: 10 }),
    fetchFeed("for_sale", { category: cat.key, limit: FOR_SALE }),
  ]);
  const shows = [...live, ...upcoming].slice(0, 10);
  const forSaleTotal = feedTotal(forSale);
  const word = cat.word;
  const nothing = !shows.length && !soon.length && !forSale.length;

  return (
    <>
      <section className="phero" aria-labelledby="h-kat">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <Link href="/kategori">Kategorier</Link>
            <span aria-hidden="true">/</span>
            <span>{cat.label}</span>
          </nav>
          <span className="label cat-label">
            <CategoryIcon k={cat.key} size={16} />
            {live.length ? `${live.length} live nu` : cat.label}
          </span>
          <h1 className="h1" id="h-kat">{cat.h1}</h1>
          <p className="lede">{cat.blurb} Spørg sælgeren i chatten, og snup det med ét tryk, mens det bliver vist.</p>
          <div className="ctas">
            {forSale.length ? (
              <a className="btn btn-red" href="#til-salg">Køb nu til fast pris</a>
            ) : (
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
            )}
            {soon.length ? <a className="btn btn-line" href="#snart">Snart live</a> : null}
          </div>
        </div>
      </section>

      {shows.length ? (
        <section className="sec tight" aria-labelledby="h-kat-shows">
          <div className="wrap">
            <div className="row-head">
              <h2 className="h3" id="h-kat-shows">{live.length ? `Live nu og snart: ${word}` : `Næste shows med ${word}`}</h2>
              <Link className="linkbtn" href="/live">Alle shows</Link>
            </div>
            <div className="cards-scroll">
              <div className="cards">
                {shows.map((s, i) => (
                  <ShowCard key={s.id} show={s} priority={i < 2} />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {soon.length ? (
        <section className="sec tight" id="snart" aria-labelledby="h-kat-snart">
          <div className="wrap">
            <div className="row-head">
              <div className="sec-head">
                <h2 className="h3" id="h-kat-snart">Snart i et live-show</h2>
                <p className="muted">Tryk Husk mig, så får du en mail, når showet starter. Du kan snuppe tingen, mens den bliver vist.</p>
              </div>
            </div>
            <div className="icards-scroll" style={{ "--n": soon.length } as React.CSSProperties}>
              <div className="icards">
                {soon.map((it) => (
                  <ItemCard key={it.id} item={it} />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="sec tight" id="til-salg" aria-labelledby="h-kat-salg">
        <div className="wrap">
          <div className="row-head">
            <div className="sec-head">
              <h2 className="h3" id="h-kat-salg">Til salg nu: {word} fra tidligere shows</h2>
              <p className="muted">Ting, der er vist frem live, men ikke blev snuppet. Du kan købe dem med det samme.</p>
            </div>
            {forSaleTotal > forSale.length ? (
              <Link className="btn btn-line btn-sm" href={`/til-salg?kategori=${cat.slug}`}>Se alle {forSaleTotal}</Link>
            ) : null}
          </div>
          {forSale.length ? (
            <div className="icards">
              {forSale.map((it, i) => (
                <ItemCard key={it.id} item={it} priority={i < 5 && !shows.length} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <p style={{ marginBottom: 14 }}>
                {nothing
                  ? `Der er intet i ${cat.label.toLowerCase()} lige nu. Kig forbi igen snart, eller se hvem der er live.`
                  : `Der er intet til salg i ${cat.label.toLowerCase()} lige nu. Usolgte ting lander her, når et show er slut.`}
              </p>
              <Link className="btn btn-line" href="/til-salg">Se alt til salg</Link>
            </div>
          )}
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-kat-how">
        <div className="wrap split-text">
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <h2 className="h2" id="h-kat-how">Hvordan køber man brugt {word} live?</h2>
          </div>
          <div>
            <ol className="steps">
              <li>
                <div>
                  <h3>Find et show eller en ting</h3>
                  <p>Se hvem der er live, eller tryk Husk mig på en ting, der bliver vist snart.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Se den tæt på, og spørg</h3>
                  <p>Bed sælgeren om at vise mærket, målene eller slid. Du får svar med det samme i chatten.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Snup den med ét tryk</h3>
                  <p>Den første, der trykker, får tingen. Du betaler sikkert, og alt fra samme sælger kommer i én pakke.</p>
                </div>
              </li>
            </ol>
            <div className="ctas" style={{ marginTop: 24 }}>
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
              <Link className="btn btn-line" href="/saadan-virker-det">Sådan køber du</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec tight" aria-labelledby="h-kat-andre">
        <div className="wrap">
          <h2 className="h3" id="h-kat-andre" style={{ marginBottom: 16 }}>Andre kategorier</h2>
          <nav className="filters" aria-label="Andre kategorier">
            {CATEGORIES.filter((c) => c.key !== cat.key).map((c) => (
              <Link key={c.key} className="fchip" href={`/kategori/${c.slug}`}>
                {c.label}
              </Link>
            ))}
          </nav>
          <p className="muted" style={{ marginTop: 8 }}>
            Har du selv {word}, der skal videre? <Link href="/saelg">Sælg det live på SnupLive</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
