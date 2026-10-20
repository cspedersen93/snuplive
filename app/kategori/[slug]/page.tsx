import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryIcon from "@/components/CategoryIcon";
import ItemCard from "@/components/ItemCard";
import ShowCard from "@/components/ShowCard";
import { CATEGORY_PAGES } from "@/lib/categoryPages";
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
  const copy = CATEGORY_PAGES[cat.key];

  const [{ live, upcoming }, soon, forSale] = await Promise.all([
    fetchListing(10, 10, cat.key),
    fetchFeed("upcoming", { category: cat.key, limit: 10 }),
    fetchFeed("for_sale", { category: cat.key, limit: FOR_SALE }),
  ]);
  const shows = [...live, ...upcoming].slice(0, 10);
  const forSaleTotal = feedTotal(forSale);
  const allForSale = `/til-salg?kategori=${cat.slug}`;

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
          <p className="lede">{copy.intro}</p>
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
              <div className="sec-head">
                <h2 className="h3" id="h-kat-shows">{copy.who}</h2>
                <p className="muted">Her er de shows, der er live nu, og dem, der starter snart.</p>
              </div>
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
                <h2 className="h3" id="h-kat-snart">{copy.soon}</h2>
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
              <h2 className="h3" id="h-kat-salg">{copy.sale}</h2>
              <p className="muted">Ting, der er vist frem live, men ikke blev snuppet. Du kan købe dem med det samme til den pris, der står på.</p>
            </div>
            {forSaleTotal > forSale.length ? (
              <Link className="btn btn-line btn-sm" href={allForSale}>{copy.saleAll}</Link>
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
                Der er intet til salg i {cat.label.toLowerCase()} lige nu. Usolgte ting lander her, når et show er slut.
              </p>
              <Link className="btn btn-line" href="/til-salg">Se alt til salg</Link>
            </div>
          )}
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-kat-tips">
        <div className="wrap split-text">
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <h2 className="h2" id="h-kat-tips">{copy.tipsH2}</h2>
            <p className="lede">På video kan du bede sælgeren om at vise præcis det, du er i tvivl om. Her er det, der er værd at spørge om.</p>
          </div>
          <div>
            <div className="tips">
              {copy.tips.map((t) => (
                <div key={t.h}>
                  <h3>{t.h}</h3>
                  <p>{t.p}</p>
                </div>
              ))}
            </div>
            {copy.note ? <p className="muted" style={{ marginTop: 18 }}>{copy.note}</p> : null}
            <div className="ctas" style={{ marginTop: 24 }}>
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-kat-how">
        <div className="wrap split-text">
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <h2 className="h2" id="h-kat-how">{copy.howH2}</h2>
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

      {copy.sellH2 ? (
        <section className="sec tight" style={{ paddingTop: 0 }} aria-labelledby="h-kat-saelg">
          <div className="wrap">
            <div className="cta-band">
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
                <h2 className="h2" id="h-kat-saelg">{copy.sellH2}</h2>
                <p className="muted">Gå live fra stuen, og sælg en hel bunke på én aften. Det, der ikke bliver solgt, kommer automatisk til salg bagefter.</p>
              </div>
              <div className="ctas">
                <Link className="btn btn-red" href="/saelg">Sælg det live</Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="sec tight" style={{ paddingTop: copy.sellH2 ? undefined : 0 }} aria-labelledby="h-kat-andre">
        <div className="wrap">
          <h2 className="h3" id="h-kat-andre" style={{ marginBottom: 16 }}>Andre kategorier</h2>
          <nav className="filters" aria-label="Andre kategorier">
            {CATEGORIES.filter((c) => c.key !== cat.key).map((c) => (
              <Link key={c.key} className="fchip" href={`/kategori/${c.slug}`}>
                {c.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </>
  );
}
