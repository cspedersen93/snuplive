import type { Metadata } from "next";
import Link from "next/link";
import CategoryCards from "@/components/CategoryCards";
import { IconBox, IconCamera, IconChat, IconShield } from "@/components/Icons";
import ItemCard from "@/components/ItemCard";
import PhoneMock from "@/components/PhoneMock";
import ShowCard from "@/components/ShowCard";
import { SITE_URL } from "@/lib/env";
import { DELIVERY } from "@/lib/pricing";
import { fetchFeed, fetchListing } from "@/lib/queries";

export const revalidate = 30;

export const metadata: Metadata = {
  title: { absolute: "Køb brugt live – tøj, børnetøj, design og vinyl | SnupLive" },
  description:
    "Køb brugt tøj, børnetøj, design og samlerting live. Se tingen på video, spørg i chatten, og snup den med ét tryk. Betalingen er beskyttet.",
  alternates: { canonical: "/" },
};

export default async function Forside() {
  const [{ live, upcoming }, soon, forSale] = await Promise.all([
    fetchListing(10, 10),
    fetchFeed("upcoming", { limit: 10 }),
    fetchFeed("for_sale", { limit: 10 }),
  ]);
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
              Køb brugt tøj og ting <em className="s">live</em> – snup det, mens det bliver vist
            </h1>
            <p className="lede">
              Sælgerne viser tingene frem på video, og du spørger løs i chatten. Kan du lide det, du ser, trykker du Snup, og så er
              det dit. Det, der ikke bliver snuppet, kan du købe bagefter til fast pris.
            </p>
            <div className="ctas">
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
              <Link className="btn btn-line" href="/til-salg">Køb nu til fast pris</Link>
            </div>
            <ul className="points">
              <li>Se tingen på video</li>
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
            <div className="sec-head">
              <span className="label red">
                <span className="live-dot" aria-hidden="true" style={{ marginRight: 8 }} />
                {live.length ? "Live nu" : "Snart live"}
              </span>
              <h2 className="h2" id="h-live-now">
                Hvem er <em className="s">live</em> lige nu?
              </h2>
            </div>
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
              <p style={{ marginBottom: 14 }}>Ingen er live lige nu. Se hvad der er til salg fra tidligere shows, eller kig forbi i aften.</p>
              <Link className="btn btn-red" href="/til-salg">Se ting til salg</Link>
            </div>
          )}
        </div>
      </section>

      <section className="sec tight" aria-labelledby="h-kategorier">
        <div className="wrap">
          <div className="row-head">
            <div className="sec-head">
              <span className="label">Kategorier</span>
              <h2 className="h2" id="h-kategorier">Hvad kan du købe brugt på SnupLive?</h2>
              <p className="lede">
                Vi har samlet de fem kategorier, hvor det giver mest mening at se tingen på video. Er stoffet tyndslidt? Har lampen
                et skår? Er pladen ridset? Det ser du, før du køber.
              </p>
            </div>
            <Link className="btn btn-line" href="/kategori">Alle kategorier</Link>
          </div>
          <CategoryCards />
        </div>
      </section>

      {soon.length ? (
        <section className="sec tight" aria-labelledby="h-snart">
          <div className="wrap">
            <div className="row-head">
              <div className="sec-head">
                <span className="label">Kommer live</span>
                <h2 className="h2" id="h-snart">Snart i et live-show</h2>
                <p className="lede">
                  Sælgerne lægger tingene ind før showet. Tryk Husk mig, så får du en mail, når showet starter, og du kan snuppe
                  tingen, mens den bliver vist.
                </p>
              </div>
              <Link className="btn btn-line" href="/live">Se programmet</Link>
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

      {forSale.length ? (
        <section className="sec tight" aria-labelledby="h-til-salg">
          <div className="wrap">
            <div className="row-head">
              <div className="sec-head">
                <span className="label mint">Køb nu</span>
                <h2 className="h2" id="h-til-salg">Til salg nu – fundet i tidligere shows</h2>
                <p className="lede">
                  Ting, der er vist frem live, men ikke blev snuppet. Prisen står på, og du kan købe dem med det samme.
                </p>
              </div>
              <Link className="btn btn-line" href="/til-salg">Se alt til salg</Link>
            </div>
            <div className="icards-scroll" style={{ "--n": forSale.length } as React.CSSProperties}>
              <div className="icards">
                {forSale.map((it) => (
                  <ItemCard key={it.id} item={it} />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
            <div className="sec-head" style={{ marginBottom: 24 }}>
              <span className="label">Sådan køber du</span>
              <h2 className="h2" id="h-how">Hvordan køber man brugt live?</h2>
            </div>
            <ol className="steps">
              <li>
                <div>
                  <h3>Find et show eller en ting</h3>
                  <p>Se hvem der er live nu, eller tryk Husk mig på en ting, der bliver vist snart. Du skal ikke hente en app.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Se den tæt på, og spørg i chatten</h3>
                  <p>Bed sælgeren om at vise mærket, målene eller stoffet tæt på, og få svar med det samme.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Snup den med ét tryk</h3>
                  <p>
                    Den første, der trykker Snup, får tingen. Du betaler samlet med MobilePay eller kort, og alt fra samme sælger kommer
                    i én pakke.
                  </p>
                </div>
              </li>
            </ol>
            <div className="ctas" style={{ marginTop: 28 }}>
              <Link className="btn btn-red" href="/live">Find et show</Link>
              <Link className="btn btn-line" href="/saadan-virker-det">Læs mere om, hvordan du køber</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-tryg">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">Tryg handel</span>
            <h2 className="h2" id="h-tryg">Er det trygt at købe brugt på SnupLive?</h2>
            <p className="lede">
              Ja. Du ser tingen, før du køber den, og sælgeren får først pengene, når du har den i hånden.
            </p>
          </div>
          <div className="feat feat-4">
            <div>
              <IconShield className="ico" />
              <h3>Pengene holdes tilbage</h3>
              <p>Du betaler gennem SnupLive, og sælgeren får først pengene, når du har fået tingene.</p>
            </div>
            <div>
              <IconCamera className="ico" />
              <h3>Du ser tingen live</h3>
              <p>Bed om at se slid, mærker og mål, før du snupper. Det er sværere at skjule en plet på video.</p>
            </div>
            <div>
              <IconBox className="ico" />
              <h3>Sporing på pakken</h3>
              <p>Pakken sendes med DAO eller GLS til en pakkeshop, og du kan følge den under Mine snup.</p>
            </div>
            <div>
              <IconChat className="ico" />
              <h3>Hjælp, hvis noget går galt</h3>
              <p>Er tingen ikke som vist, trykker du Meld et problem. Så holder vi pengene tilbage og hjælper jer.</p>
            </div>
          </div>
          <div className="ctas" style={{ marginTop: 28 }}>
            <Link className="btn btn-line" href="/saadan-virker-det#tryg-handel">Sådan passer vi på dig</Link>
            <Link className="btn btn-line" href="/faq">Spørgsmål og svar</Link>
          </div>
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-compare">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">Live shopping med brugt</span>
            <h2 className="h2" id="h-compare">Hvad er forskellen på at købe brugt live og en almindelig annonce?</h2>
            <p className="lede">
              På en almindelig annonce ser du billeder og skriver frem og tilbage med sælgeren. På SnupLive ser du tingen på video,
              får svar med det samme og køber, mens den bliver vist.
            </p>
          </div>
          <div className="table-wrap">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col">Sådan handler du</th>
                  <th scope="col" className="us">SnupLive</th>
                  <th scope="col">Almindelige annoncer</th>
                  <th scope="col">Salgsgrupper på sociale medier</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Se tingen på video, før du køber</th>
                  <td className="us yes">Ja, live</td>
                  <td className="no">Nej, kun billeder</td>
                  <td className="no">Kun hvis sælgeren går live</td>
                </tr>
                <tr>
                  <th scope="row">Spørg og få svar med det samme</th>
                  <td className="us yes">Ja, i chatten</td>
                  <td className="no">Beskeder frem og tilbage</td>
                  <td className="no">Kommentarer og beskeder</td>
                </tr>
                <tr>
                  <th scope="row">Køb, mens tingen bliver vist</th>
                  <td className="us yes">Ja, med Snup-knappen</td>
                  <td className="no">Nej</td>
                  <td className="no">Du skriver &quot;solgt&quot; i en kommentar</td>
                </tr>
                <tr>
                  <th scope="row">Alt fra samme sælger i én pakke</th>
                  <td className="us yes">Ja, automatisk</td>
                  <td className="no">Aftales med sælgeren</td>
                  <td className="no">Aftales selv</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="ctas" style={{ marginTop: 28 }}>
            <Link className="btn btn-red" href="/live">Prøv at se med</Link>
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
            <ul className="ticks" style={{ maxWidth: 520 }}>
              <li>Sælg en hel bunke på én aften, uden at fotografere og måle hver eneste ting</li>
              <li>Svar på alle spørgsmål på én gang i chatten</li>
              <li>Det, der ikke bliver solgt, kommer automatisk til salg til fast pris</li>
            </ul>
            <Link className="btn btn-red" href="/saelg">Sådan sælger du live</Link>
          </article>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-band">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="label red">Kom i gang</span>
              <h2 className="h2">Klar til at gøre et godt snup?</h2>
            </div>
            <div className="ctas">
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
              <Link className="btn btn-line" href="/opret">Opret gratis konto</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
