import type { Metadata } from "next";
import Link from "next/link";
import { IconBolt, IconBox, IconCamera, IconCard, IconDoc, IconList } from "@/components/Icons";

export const metadata: Metadata = {
  title: { absolute: "Sælg brugt tøj live på video | SnupLive" },
  description:
    "Gå live fra telefonen eller computeren, vis dine ting frem og sælg en hel bunke på én aften. Gratis at oprette sælgerkonto.",
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
          <h1 className="h1" id="h-saelg">Sælg brugt tøj og ting live på video</h1>
          <p className="lede">
            Gå live fra telefonen, vis dine ting frem, og sælg en hel bunke på én aften.
          </p>
          <div className="ctas">
            <Link className="btn btn-red" href="/opret">Opret gratis konto</Link>
            <Link className="btn btn-line" href="/studio">Gå til studiet</Link>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-saelg-how">
        <div className="wrap split">
          <figure className="photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/s-phone.jpg" alt="Telefon på stativ med ringlys viser en sælger, der er live" loading="lazy" width={1200} height={800} />
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
              <li><div><h3>Opret et show</h3><p>Giv det en titel, vælg kategori og tidspunkt. Showet kommer i programmet under Live nu.</p></div></li>
              <li><div><h3>Læg dine ting i køen</h3><p>Navn, størrelse og pris er nok. Lægger du billeder og en beskrivelse på, kan køberne finde tingene og trykke Husk mig før showet.</p></div></li>
              <li><div><h3>Gå live fra studiet</h3><p>Vis tingene frem én ad gangen. Køberne snupper med ét tryk, og du kan starte lynrunder eller budsalg, når stemningen er god.</p></div></li>
              <li><div><h3>Pak, send og få pengene</h3><p>Når køberen har betalt, får du adressen. Send pakken, og når køberen har fået den, går pengene til din bankkonto.</p></div></li>
            </ol>
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
            <div><IconCamera /><h3>Studie i browseren</h3><p>Gå live fra telefonen eller computeren uden at installere noget. Skift mellem for- og bagkamera.</p></div>
            <div><IconList /><h3>Kø af varer</h3><p>Dine ting står klar i rækkefølge, og du viser den næste med ét tryk.</p></div>
            <div><IconBolt /><h3>Lynrunder og budsalg</h3><p>Lynrunder på ti sekunder til fast pris, eller budsalg på 30 sekunder, hvor det højeste bud vinder. Det giver liv i showet.</p></div>
            <div><IconBox /><h3>Fragtlabels med ét tryk</h3><p>Køberen har valgt pakkeshop og betalt fragten. Du printer labelen og afleverer pakken hos DAO eller GLS.</p></div>
            <div><IconCard /><h3>Udbetaling til din konto</h3><p>Tilknyt din bankkonto via Stripe. Pengene udbetales, når køberen har fået sine ting.</p></div>
            <div><IconDoc /><h3>Usolgt kommer til salg</h3><p>Det, der ikke bliver snuppet, kan købes bagefter til fast pris med et billede fra showet. Så fortsætter salget, når du har slukket kameraet.</p></div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-saelg-faq">
        <div className="wrap faq">
          <div className="sec-head">
            <h2 className="h2" id="h-saelg-faq">Spørgsmål fra nye sælgere</h2>
            <p className="lede">Flere svar finder du under <Link href="/faq">spørgsmål og svar</Link>.</p>
          </div>
          <div className="faq-list">
            <details open><summary><h3>Hvad koster det at sælge?</h3><span className="pm" aria-hidden="true">+</span></summary><p>Det er gratis at oprette en konto, gå live og sælge i beta-perioden. Køberen betaler en køberbeskyttelse på 5 % + 5 kr pr. pakke. Hvis vi senere indfører et salgsgebyr, får du besked, før det gælder.</p></details>
            <details><summary><h3>Hvad skal jeg bruge for at gå live?</h3><span className="pm" aria-hidden="true">+</span></summary><p>En telefon eller computer med kamera og en stabil internetforbindelse. Et stativ og et ringlys gør billedet bedre, men det er ikke et krav.</p></details>
            <details><summary><h3>Hvor længe skal et show vare?</h3><span className="pm" aria-hidden="true">+</span></summary><p>Det bestemmer du. Mange starter med 20 minutter og 10 til 15 ting.</p></details>
            <details><summary><h3>Kan en genbrugsbutik også sælge live?</h3><span className="pm" aria-hidden="true">+</span></summary><p>Ja. Butikker kan oprette en konto og gå live fra butikken, fx med ugens nye varer.</p></details>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-band">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 className="h2">Gå live med dit første show</h2>
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
