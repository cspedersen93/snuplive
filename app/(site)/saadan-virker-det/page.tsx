import type { Metadata } from "next";
import Link from "next/link";
import { IconCamera, IconChat, IconShield, IconShieldCheck, IconStar, IconUser } from "@/components/Icons";
import { kr } from "@/lib/format";
import {
  AUTO_COMPLETE_DAYS,
  DELIVERED_COMPLETE_DAYS,
  DELIVERY,
  OFFER_HOURS,
  OFFER_MIN_PCT,
  RESERVATION_DAYS,
  bundleDiscount,
  orderAmounts,
  PARCELS,
  SHIP_PRICES_TEXT,
} from "@/lib/pricing";
import { createPublicClient } from "@/lib/supabase/public";

// Én side med det hele: hvordan man køber, hvad det koster, fragt, rabat og bud, tryg handel og sortering.
// Tallene kommer fra lib/pricing.ts, så siden altid passer med kurven og betalingen.

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Sådan virker live shopping: priser, fragt og rabat | Relived" },
  description:
    "Alt om at købe og sælge live på Relived samlet ét sted: hvordan du køber, køberbeskyttelse, fragt og afhentning, samlerabat, bud og tryg handel.",
  alternates: { canonical: "/saadan-virker-det" },
};

/** Er samlerabat (0027) og bud (0028) slået til? Uden filerne står de ikke på siden. */
async function features() {
  const sb = createPublicClient();
  if (!sb) return { bundles: false, offers: false };
  const [b, o] = await Promise.all([sb.from("bundle_discounts").select("seller_id").limit(1), sb.rpc("offer_min", { p_price: 100 })]);
  return { bundles: !b.error, offers: !o.error };
}

export default async function Saadan() {
  const { bundles, offers } = await features();
  const ship = DELIVERY.ship.price;
  // Regneeksemplet: 2 varer til 200 kr hos samme sælger, med 10 % i samlerabat, hvis den findes.
  const ex = orderAmounts(400, "ship", bundles ? bundleDiscount(400, 2, { pct2: 10, pct3: 15 }) : 0);

  const jump = [
    ["koeb", "Køb"],
    ["priser", "Priser"],
    ["fragt", "Fragt"],
    ...(bundles || offers ? [["rabat", bundles && offers ? "Rabat og bud" : bundles ? "Rabat" : "Bud"]] : []),
    ["tryg-handel", "Tryg handel"],
    ["saelg", "Sælg"],
  ];

  return (
    <>
      <section className="phero" aria-labelledby="h-saadan">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Sådan virker det</span>
          </nav>
          <h1 className="h1" id="h-saadan">Sådan virker live shopping på Relived</h1>
          <p className="lede">
            Det vigtigste samlet ét sted: hvordan du køber, hvad det koster, fragt{bundles || offers ? ", rabat og bud" : ""}, og hvordan vi
            passer på dig.
          </p>
          <nav className="howto-jump" aria-label="Spring til">
            {jump.map(([id, label]) => (
              <a key={id} href={`#${id}`}>{label}</a>
            ))}
          </nav>
        </div>
      </section>

      {/* Kort fortalt */}
      <section className="sec howto-kort" aria-labelledby="h-kort">
        <div className="wrap">
          <h2 className="sr-only" id="h-kort">Kort fortalt</h2>
          <ul className="kort-grid">
            <li>
              <b>{offers ? "3 måder" : "2 måder"}</b>
              <span>at købe på: live, med Køb nu{offers ? " eller med et bud" : ""}.</span>
            </li>
            <li>
              <b>Fra {kr(ship)}</b>
              <span>i fragt pr. pakke til pakkeshop ({SHIP_PRICES_TEXT}). Afhentning er gratis.</span>
            </li>
            <li>
              <b>5 % + 5 kr</b>
              <span>i køberbeskyttelse pr. pakke. Sælgeren får først pengene, når du har varen.</span>
            </li>
            <li>
              <b>1 pakke</b>
              <span>pr. sælger. Du betaler kun fragt én gang{bundles ? ", og nogle sælgere giver samlerabat" : ""}.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Køb */}
      <section className="sec band" aria-labelledby="h-koeb" id="koeb">
        <div className="wrap">
          <div className="sec-head">
            <span className="label mint">For købere</span>
            <h2 className="h2" id="h-koeb">Hvordan køber jeg?</h2>
            <p className="lede">Du behøver ikke en app. Det hele foregår her på siden, både på telefonen og computeren.</p>
          </div>
          <div className={`howto-ways${offers ? "" : " two"}`}>
            <div>
              <span className="chip live">Live</span>
              <h3>Køb i et live-show</h3>
              <p>
                Sælgeren viser varen frem, og du kan spørge i chatten. Den første, der trykker <b>Køb</b>, får varen. Står der{" "}
                <b>Budsalg</b>, har du 30 sekunder til at byde, og det højeste bud vinder.
              </p>
              <Link className="linkbtn" href="/live">Se hvem der er live</Link>
            </div>
            <div>
              <span className="chip ok">Køb nu</span>
              <h3>Køb til fast pris</h3>
              <p>
                Det, der ikke blev solgt i showet, og videoannoncer kan købes til fast pris. Tryk <b>Køb nu</b>, så er varen reserveret til
                dig.
              </p>
              <Link className="linkbtn" href="/til-salg">Se alt til salg</Link>
            </div>
            {offers ? (
              <div>
                <span className="chip">Bud</span>
                <h3>Giv et bud</h3>
                <p>
                  På varer til fast pris kan du byde lidt under prisen. Sælgeren siger ja eller nej. Siger sælgeren ja, er varen din til
                  buddet. <a href="#bud">Sådan virker bud</a>
                </p>
              </div>
            ) : null}
          </div>

          <h3 className="howto-sub">Når du har købt</h3>
          <ol className="steps howto-steps">
            <li>
              <div>
                <h3>Betal samlet inden {RESERVATION_DAYS} dage</h3>
                <p>Under Mine køb betaler du for det hele på én gang med MobilePay, kort, Apple Pay eller Google Pay.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Sælgeren sender pakken</h3>
                <p>Eller I aftaler, hvornår du henter varen. Du kan følge pakken under Mine køb.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Bekræft, at du har fået varen</h3>
                <p>
                  Først da får sælgeren pengene. Bekræfter du ikke selv, sker det automatisk {DELIVERED_COMPLETE_DAYS} dage efter, at du har
                  hentet pakken, eller {AUTO_COMPLETE_DAYS} dage efter, at den er sendt.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Priser */}
      <section className="sec" aria-labelledby="h-priser" id="priser">
        <div className="wrap howto-two">
          <div className="sec-head">
            <h2 className="h2" id="h-priser">Hvad koster det?</h2>
            <p className="lede">Du betaler for varen, fragten og køberbeskyttelsen. Der er ingen andre gebyrer.</p>
          </div>
          <div>
            <table className="price-table">
              <caption className="sr-only">Priser for købere og sælgere</caption>
              <tbody>
                <tr>
                  <th scope="row">Varen</th>
                  <td>Sælgerens pris. Den står ved varen.</td>
                </tr>
                <tr>
                  <th scope="row">Fragt til pakkeshop</th>
                  <td>{SHIP_PRICES_TEXT} pr. pakke med DAO eller GLS</td>
                </tr>
                <tr>
                  <th scope="row">Afhentning hos sælgeren</th>
                  <td>Gratis</td>
                </tr>
                <tr>
                  <th scope="row">Køberbeskyttelse</th>
                  <td>5 % af varerne + 5 kr pr. pakke</td>
                </tr>
                {bundles ? (
                  <tr>
                    <th scope="row">Samlerabat</th>
                    <td>Nogle sælgere giver rabat, når du køber flere varer. Den bliver trukket fra automatisk.</td>
                  </tr>
                ) : null}
                <tr>
                  <th scope="row">At sælge</th>
                  <td>Gratis, mens vi er i beta</td>
                </tr>
              </tbody>
            </table>
            <div className="calc" aria-label="Regneeksempel">
              <p className="calc-head">
                <b>Eksempel:</b> 2 varer til 200 kr hos samme sælger{bundles ? ", som giver 10 % i samlerabat" : ""}
              </p>
              <dl>
                <div><dt>Varer</dt><dd>{kr(ex.gross)}</dd></div>
                {ex.discount ? <div className="minus"><dt>Samlerabat</dt><dd>−{kr(ex.discount)}</dd></div> : null}
                <div><dt>Fragt (én pakke)</dt><dd>{kr(ex.shipping)}</dd></div>
                <div><dt>Køberbeskyttelse</dt><dd>{kr(ex.fee)}</dd></div>
                <div className="total"><dt>I alt</dt><dd>{kr(ex.total)}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Fragt */}
      <section className="sec band" aria-labelledby="h-fragt" id="fragt">
        <div className="wrap howto-two">
          <div className="sec-head">
            <h2 className="h2" id="h-fragt">Fragt og afhentning</h2>
            <p className="lede">Du vælger, når du betaler. Alt fra samme sælger kommer i én pakke.</p>
          </div>
          <ul className="howto-list">
            <li>
              <b>Pakkeshop: fra {kr(ship)}</b>
              <span>
                {kr(PARCELS.small.price)} for en lille pakke op til 1 kg, fx et par stykker tøj, og {kr(PARCELS.large.price)} for en stor pakke op til 5 kg,
                fx sko, en lampe eller flere varer. Du ser prisen i kurven, vælger en DAO- eller GLS-pakkeshop og kan følge pakken.
              </span>
            </li>
            <li>
              <b>Én pakke pr. sælger</b>
              <span>Alt, du køber hos samme sælger, også fra flere shows, sendes samlet. Du betaler kun fragt én gang.</span>
            </li>
            <li>
              <b>Afhentning: gratis</b>
              <span>I aftaler tid og sted, og sælgeren får dit telefonnummer. Se varen efter, før du bekræfter, at du har fået den.</span>
            </li>
            <li>
              <b>Cykler og barnevogne</b>
              <span>De er for store til en pakkeshop, så de hentes hos sælgeren.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Rabat og bud */}
      {bundles || offers ? (
        <section className="sec" aria-labelledby="h-rabat" id="rabat">
          <div className="wrap howto-two">
            <div className="sec-head">
              <h2 className="h2" id="h-rabat">{bundles && offers ? "Rabat og bud" : bundles ? "Samlerabat" : "Bud på varer"}</h2>
              <p className="lede">Sådan kan du købe billigere.</p>
            </div>
            <ul className="howto-list">
              {bundles ? (
                <li id="samlerabat">
                  <b>Samlerabat</b>
                  <span>
                    Nogle sælgere giver rabat, når du køber flere varer hos dem, fx 10 % ved 2 varer og 15 % ved 3. Rabatten står ved
                    sælgeren og bliver trukket fra automatisk i kurven. Den gælder alt, du betaler hos sælgeren på én gang.
                  </span>
                </li>
              ) : null}
              {offers ? (
                <li id="bud">
                  <b>Giv et bud</b>
                  <span>
                    På varer til fast pris kan du byde mindst {OFFER_MIN_PCT} % af prisen. Sælgeren har {OFFER_HOURS} timer til at svare, og
                    du får besked. Siger sælgeren ja, lander varen i din kurv til buddet, og du betaler inden {RESERVATION_DAYS} dage. Du kan
                    ændre eller trække dit bud tilbage, indtil sælgeren svarer.
                  </span>
                </li>
              ) : null}
              <li>
                <b>Budsalg i live-shows</b>
                <span>Buddene starter ved startprisen, og det højeste bud vinder. Byder ingen, kan varen købes bagefter til startprisen.</span>
              </li>
            </ul>
          </div>
        </section>
      ) : null}

      {/* Tryg handel */}
      <section className={`sec${bundles || offers ? " band" : ""}`} aria-labelledby="h-tryg" id="tryg-handel">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="h2" id="h-tryg">Hvordan er det trygt at handle live?</h2>
          </div>
          <div className="feat">
            <div><IconShield /><h3>Pengene holdes tilbage</h3><p>Sælgeren får først pengene, når du har fået dine varer, og du kan følge pakken hele vejen.</p></div>
            <div><IconCamera /><h3>Du ser varen live</h3><p>Bed om at se mærket, målene og standen tæt på, før du køber.</p></div>
            <div><IconChat /><h3>Hjælp, hvis noget går galt</h3><p>Tryk Meld et problem på ordren, inden pengene bliver udbetalt. Så holder vi pengene tilbage og hjælper jer med at finde en løsning.</p></div>
            <div><IconShieldCheck className="ico" /><h3>Mærkevarer bliver tjekket</h3><p>Designertasker, ure og andre mærkevarer bliver ægthedstjekket, før de kan købes. Er en vare falsk, får du alle pengene tilbage.</p></div>
            <div><IconStar /><h3>Bedømmelser</h3><p>Efter hver handel kan køberen give sælgeren stjerner, så du kan se, hvem du handler med.</p></div>
            <div><IconUser className="ico" /><h3>Sælgerne bliver tjekket</h3><p>Før en sælger kan få penge udbetalt, skal sælgeren bekræfte sin identitet hos vores betalingspartner Stripe.</p></div>
          </div>
          <p className="muted howto-note">
            Køber du hos en virksomhed, har du 14 dages fortrydelsesret. Køb fra privatpersoner er ikke omfattet. Det står ved sælgeren på
            hver vare. <Link href="/handelsbetingelser#fortrydelsesret">Læs handelsbetingelserne</Link>
          </p>
        </div>
      </section>

      {/* Sælg */}
      <section className="sec" aria-labelledby="h-seller" id="saelg">
        <div className="wrap">
          <div className="cta-band">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="label red">For sælgere</span>
              <h2 className="h2" id="h-seller">Vil du sælge?</h2>
              <p className="lede" style={{ margin: 0 }}>
                Gratis i beta. Gå live fra telefonen, eller film en vare med Sælg med video. Pengene går til din bankkonto, når køberen har
                fået varen.
              </p>
            </div>
            <div className="ctas">
              <Link className="btn btn-red" href="/saelg">Læs om at sælge</Link>
              <Link className="btn btn-line" href="/studio">Gå til studiet</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sortering */}
      <section className="sec band" aria-labelledby="h-sortering" id="sortering">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <h2 className="h2" id="h-sortering" style={{ marginBottom: 18 }}>Sådan sorterer vi</h2>
          <ul className="sort-list">
            <li><b>Live nu:</b> de shows, der er startet senest, står først.</li>
            <li><b>Snart live og budsalg:</b> efter hvornår showet starter. Budsalg, der kører lige nu, står først.</li>
            <li><b>Til salg:</b> de varer, der senest er kommet til salg, står først.</li>
            <li><b>Kategorier og sælgere:</b> samme rækkefølge, kun med de varer, der passer.</li>
          </ul>
          <p className="muted" style={{ marginTop: 14 }}>Ingen sælger kan betale sig til en bedre plads, og vi sorterer ikke efter, hvad vi tjener.</p>
          <div className="ctas" style={{ marginTop: 28 }}>
            <Link className="btn btn-line" href="/faq">Flere spørgsmål og svar</Link>
            <Link className="btn btn-line" href="/guides/koeb-brugt-toej-online">Sådan køber du brugt trygt</Link>
          </div>
        </div>
      </section>
    </>
  );
}
