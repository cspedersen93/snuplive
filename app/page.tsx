import Link from "next/link";
import PhoneMock from "@/components/PhoneMock";
import ShowCard from "@/components/ShowCard";
import { SITE_URL } from "@/lib/env";
import { fetchListing } from "@/lib/queries";

export const revalidate = 30;

export default async function Forside() {
  const { live, upcoming } = await fetchListing(10, 10);
  const cards = [...live, ...upcoming].slice(0, 10);

  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SnupLive",
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/img/logo.png`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
      <section className="hero" aria-labelledby="h-forside">
        <div className="wrap">
          <div className="hero-copy">
            <span className="eyebrow label">
              <span className="live-dot" aria-hidden="true" />
              Live shopping med brugte ting
            </span>
            <h1 id="h-forside">
              Sælg dit brugte <em className="s">live</em> på video.
            </h1>
            <p className="lede">
              SnupLive er et loppemarked på nettet. Sælgeren går live fra stuen og viser tingene frem, mens du chatter
              med og snupper det, du kan lide, med ét tryk.
            </p>
            <div className="ctas">
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
              <Link className="btn btn-line" href="/saelg">Sælg live</Link>
            </div>
            <ul className="points">
              <li>Direkte i browseren</li>
              <li>Ingen app nødvendig</li>
              <li>Samlet fragt pr. show</li>
            </ul>
          </div>
          <PhoneMock />
        </div>
      </section>

      <section className="sec" aria-labelledby="h-live-now">
        <div className="wrap">
          <div className="row-head">
            <div className="sec-head">
              <span className="label red">
                <span className="live-dot" aria-hidden="true" style={{ marginRight: 8 }} />
                {live.length ? `${live.length} ${live.length === 1 ? "sælger er" : "sælgere er"} live` : "Live nu"}
              </span>
              <h2 className="h2" id="h-live-now">
                Hvem er <em className="s">live</em> lige nu?
              </h2>
            </div>
            <Link className="btn btn-line" href="/live">Se alle shows</Link>
          </div>
          {cards.length ? (
            <div className="cards-scroll">
              <div className="cards">
                {cards.map((s, i) => (
                  <ShowCard key={s.id} show={s} priority={i < 2} />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty">
              <p style={{ marginBottom: 14 }}>Ingen er live lige nu. Vær den første, der går live med sine ting.</p>
              <Link className="btn btn-red" href="/studio">Gå live</Link>
            </div>
          )}
        </div>
      </section>

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
              <span className="label">Sådan virker det</span>
              <h2 className="h2" id="h-how">Hvordan foregår live shopping?</h2>
            </div>
            <ol className="steps">
              <li><div><h3>Sælgeren går live</h3><p>Fra telefonen eller computeren, direkte i browseren. Showet dukker op under Live nu, så snart det starter.</p></div></li>
              <li><div><h3>Du ser med og spørger i chatten</h3><p>Bed om at se mærket, målene eller stoffet tæt på, og få svar med det samme.</p></div></li>
              <li><div><h3>Du snupper med ét tryk</h3><p>Den første, der trykker Snup, får tingen. Du betaler samlet med MobilePay eller kort, og alt fra samme show kommer i én pakke.</p></div></li>
            </ol>
            <div className="ctas" style={{ marginTop: 28 }}>
              <Link className="btn btn-line" href="/saadan-virker-det">Læs mere om, hvordan det virker</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-compare">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">Live shopping med brugt</span>
            <h2 className="h2" id="h-compare">Hvad er forskellen på SnupLive og en almindelig annonce?</h2>
            <p className="lede">
              Live shopping er salg på video i realtid. Du ser tingen fra alle sider, stiller spørgsmål, mens sælgeren er
              der, og køber med det samme. Det er hurtigere end at skrive frem og tilbage om en annonce, og mere
              overskueligt end at skrive &quot;solgt&quot; i en kommentar.
            </p>
          </div>
          <div className="table-wrap">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col">Det får du</th>
                  <th scope="col" className="us">SnupLive</th>
                  <th scope="col">Salg i Facebook-grupper</th>
                  <th scope="col">Almindelige annonce-apps</th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">Se tingen live på video</th><td className="us yes">Ja</td><td className="yes">Ja</td><td className="no">Nej, kun billeder</td></tr>
                <tr><th scope="row">Køb med ét tryk</th><td className="us yes">Ja, Snup-knappen</td><td className="no">Nej, du skriver &quot;solgt&quot;</td><td className="yes">Ja</td></tr>
                <tr><th scope="row">Samlet fragt for alt fra samme show</th><td className="us yes">Ja, automatisk</td><td className="no">Aftales selv</td><td className="no">Kun ved bundter</td></tr>
                <tr><th scope="row">Betalingen holdes tilbage, til du har varen</th><td className="us yes">Ja</td><td className="no">Nej, du overfører selv</td><td className="yes">Ja</td></tr>
                <tr><th scope="row">Ingen algoritme, der gemmer showet</th><td className="us yes">Ja, alle live-shows vises</td><td className="no">Afhænger af algoritmen</td><td className="no">Nej</td></tr>
                <tr><th scope="row">Sælgere verificeret med MitID</th><td className="us yes">Ja, ved lanceringen</td><td className="no">Nej</td><td className="no">Nej</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-sides">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">Sælgere og købere</span>
            <h2 className="h2" id="h-sides">Hvorfor sælge og købe live?</h2>
          </div>
          <div className="sides">
            <article className="panel img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/s-phone.jpg" alt="Telefon på stativ med ringlys viser en sælger, der er live" loading="lazy" />
              <span className="label red">Til sælgere</span>
              <h3>Sælg en hel bunke på én aften</h3>
              <ul className="ticks">
                <li>Ingen fotosession og opmåling for hver eneste ting</li>
                <li>Svar på alle spørgsmål på én gang i chatten</li>
                <li>Kø, lynrunder og salgsoversigt i studiet</li>
              </ul>
              <Link className="btn btn-red" href="/saelg">Sådan sælger du live</Link>
            </article>
            <article className="panel plain">
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <span className="label mint">Til købere</span>
                <h3>Se tingen, før du køber den</h3>
                <ul className="ticks">
                  <li>Bed sælgeren vende den, måle den eller prøve den på</li>
                  <li>Snup med ét tryk, mens du ser med</li>
                  <li>Alt fra samme show samlet i én pakke</li>
                </ul>
              </div>
              <div className="mini-chat" aria-label="Eksempel på chat under et live-show">
                <div className="bubble"><b>liva.k</b>Hvor lang er kjolen?</div>
                <div className="bubble me"><b>majasgarderobe</b>92 cm fra skulderen. Jeg tager den på, 2 sek.</div>
                <div className="bubble"><b>liva.k</b>Den snupper jeg!</div>
              </div>
              <Link className="btn btn-line" href="/live">Find et show</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="cta-band">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="label red">Kom i gang</span>
              <h2 className="h2">Klar til at rydde skabet live?</h2>
            </div>
            <div className="ctas">
              <Link className="btn btn-red" href="/opret">Opret gratis konto</Link>
              <Link className="btn btn-line" href="/saelg">Sådan sælger du</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
