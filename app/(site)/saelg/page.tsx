import type { Metadata } from "next";
import Link from "next/link";
import { IconBolt, IconBox, IconCamera, IconCard, IconClip, IconList } from "@/components/Icons";
import { inBeta } from "@/lib/launch";

export const metadata: Metadata = {
  title: { absolute: `Sælg second hand live på video – ${inBeta() ? "gratis i beta" : "gratis"} | Relived` },
  description:
    `Gå live fra telefonen, og sælg en hel bunke på én aften: brugte fund, ubrugte fejlkøb og nye restpartier. ${inBeta() ? "Gratis at sælge i beta." : "Gratis at sælge."}`,
  alternates: { canonical: "/saelg" },
};

export default function Saelg() {
  return (
    <>
      <section className="phero" aria-labelledby="h-saelg">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Sælg live</span>
          </nav>
          <h1 className="h1" id="h-saelg">Sælg second hand live på video</h1>
          <p className="lede">
            <b>Sælg brugte fund, ubrugte fejlkøb og nye restpartier live.</b> Glem at fotografere og skrive en annonce til hver eneste vare. Gå live fra telefonen, vis varerne frem én ad gangen, og
            sælg en hel bunke på én aften.
          </p>
          <div className="ctas">
            <Link className="btn btn-red" href="/opret">Opret gratis konto</Link>
            <Link className="btn btn-line" href="/studio">Gå til studiet</Link>
          </div>
          <ul className="points" style={{ marginTop: 22 }}>
            <li>{inBeta() ? "Gratis at sælge i beta" : "Gratis at sælge"}</li>
            <li>Ingen app at installere</li>
            <li>Pengene direkte på din konto</li>
            <li>Som privatperson eller virksomhed</li>
          </ul>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-saelg-how">
        <div className="wrap split">
          <figure className="photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/saelg-stue.jpg" alt="En sælger sidder i sofaen og viser en taske frem live, med trøjer og et tøjstativ ved siden af" loading="lazy" width={1360} height={768} />
            <figcaption>
              <span className="live-dot" aria-hidden="true" />
              Telefon, stativ og et godt lys
            </figcaption>
          </figure>
          <div>
            <div className="sec-head" style={{ marginBottom: 24 }}>
              <h2 className="h2" id="h-saelg-how">Hvordan går jeg live og sælger?</h2>
            </div>
            <ol className="steps">
              <li><div><h3>Opret et show</h3><p>Giv det en titel, og vælg kategori og tidspunkt. Showet kommer i programmet under Live nu, og dine følgere får besked, når du går live.</p></div></li>
              <li><div><h3>Læg dine varer i køen</h3><p>Navn og pris er nok. Lægger du billeder og en beskrivelse på, kan køberne finde varerne og trykke Husk mig før showet.</p></div></li>
              <li><div><h3>Gå live fra studiet</h3><p>Vis varerne frem én ad gangen. Køberne køber med ét tryk, og du kan starte lynrunder eller budsalg, når stemningen er god.</p></div></li>
              <li><div><h3>Pak, send og få pengene</h3><p>Når køberen har betalt, printer du fragtlabelen og afleverer pakken. Når køberen har fået den, går pengene til din bankkonto.</p></div></li>
            </ol>
            {/* Regneeksempel: hvad sælgeren får ud af et show. Køberne betaler fragt og køberbeskyttelse. */}
            <div className="sell-example">
              <span className="label red">Regneeksempel</span>
              <p>
                Du sælger <b>10 varer á 150 kr</b> på én aften. Så får du <b>1.500 kr</b> ind på din konto. Køberne betaler fragten og
                køberbeskyttelsen, og det koster dig 0 kr at sælge{inBeta() ? ", mens vi er i beta" : ""}.
              </p>
            </div>
            <div className="ctas" style={{ marginTop: 28 }}>
              <Link className="btn btn-red" href="/studio">Opret dit første show</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-saelg-tools">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="h2" id="h-saelg-tools">Hvad får jeg med som sælger?</h2>
          </div>
          <div className="feat">
            <div><IconCamera /><h3>Studie i browseren</h3><p>Gå live fra telefonen eller computeren uden at installere noget. Skift mellem for- og bagkamera, lys billedet op, eller slør baggrunden.</p></div>
            <div><IconList /><h3>Kø af varer</h3><p>Dine varer står klar i rækkefølge, og du viser den næste med ét tryk.</p></div>
            <div><IconBolt /><h3>Lynrunder og budsalg</h3><p>Lynrunder på ti sekunder til fast pris, eller budsalg på 30 sekunder, hvor det højeste bud vinder. Det giver liv i showet.</p></div>
            <div><IconBox /><h3>Fragtlabels med ét tryk</h3><p>Køberen har valgt pakkeshop og betalt fragten. Du printer labelen og afleverer pakken hos DAO eller GLS. Alt, en køber har købt hos dig, sendes i én pakke.</p></div>
            <div><IconCard /><h3>Udbetaling til din konto</h3><p>Tilknyt din bankkonto via Stripe. Pengene udbetales, når køberen har fået sine varer.</p></div>
            <div><IconClip /><h3>Sælg også uden at være live</h3><p>Det, der ikke bliver solgt, kan købes bagefter til fast pris med et klip fra showet. Er du ikke til kamera, kan du filme varen uden selv at være med og sætte den til salg med <b>Sælg med video</b>.</p></div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-saelg-faq">
        <div className="wrap faq">
          <div className="sec-head">
            <h2 className="h2" id="h-saelg-faq">Spørgsmål fra nye sælgere</h2>
            <p className="lede">Flere svar finder du under <Link href="/faq">spørgsmål og svar</Link> og i guiden <Link href="/guides/saelg-live-foerste-gang">sælg live første gang</Link>.</p>
          </div>
          <div className="faq-list">
            <details open><summary><h3>Hvad koster det at sælge?</h3><span className="pm" aria-hidden="true">+</span></summary><p>Det er gratis at oprette en konto, gå live og sælge{inBeta() ? " i beta-perioden" : ""}. Køberen betaler en køberbeskyttelse på 5 % + 5 kr pr. pakke. Hvis vi senere indfører et salgsgebyr, får du besked, før det gælder.</p></details>
            <details><summary><h3>Hvad skal jeg bruge for at gå live?</h3><span className="pm" aria-hidden="true">+</span></summary><p>En telefon eller computer med kamera og en stabil internetforbindelse. Et stativ og et ringlys gør billedet bedre, men det er ikke et krav.</p></details>
            <details><summary><h3>Hvor længe skal et show vare?</h3><span className="pm" aria-hidden="true">+</span></summary><p>Det bestemmer du. Et godt første show er 20 minutter og 10 til 15 varer. I studiet er der en rundvisning, der viser dig, hvad hver knap gør.</p></details>
            <details><summary><h3>Kan jeg sælge sammen med en veninde?</h3><span className="pm" aria-hidden="true">+</span></summary><p>Ja. I studiet trykker du Inviter en sælger og sender linket. Op til 2 andre sælgere kan være med som gæster. I er på kameraet sammen, hver lægger sine egne varer i køen og får selv pengene for dem, og I tager hinandens følgere med. Du styrer, hvad der vises.</p></details>
            <details><summary><h3>Kan en butik også sælge live?</h3><span className="pm" aria-hidden="true">+</span></summary><p>Ja. Genbrugsbutikker og butikker med restpartier kan oprette en konto og gå live fra butikken, fx med ugens nye varer. Vælg <b>Virksomhed</b>, når du bliver sælger.</p></details>
            <details><summary><h3>Jeg køber partier hjem og sælger dem videre. Hvad skal jeg vælge?</h3><span className="pm" aria-hidden="true">+</span></summary><p>Køber du varer ind for at sælge dem videre med fortjeneste, er det erhverv, og så sælger du som virksomhed. Vælg <b>Virksomhed</b>, når du bliver sælger, og skriv firmanavn og CVR-nummer. Køberne kan se det ved dine varer, og når de køber af en virksomhed, har de 14 dages fortrydelsesret og 2 års reklamationsret.</p></details>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-band">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 className="h2">Dit første show kan være i aften</h2>
              <p className="lede" style={{ margin: 0 }}>Opret en gratis konto, læg 10 varer i køen, og gå live, når det passer dig.</p>
            </div>
            <div className="ctas">
              <Link className="btn btn-red" href="/opret">Opret gratis konto</Link>
              <Link className="btn btn-line" href="/saadan-virker-det">Sådan virker det</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
