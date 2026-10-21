import type { Metadata } from "next";
import Link from "next/link";
import { IconBox, IconCamera, IconChat, IconShield, IconStar, IconUser } from "@/components/Icons";

export const metadata: Metadata = {
  title: { absolute: "Sådan virker live shopping | SnupLive" },
  description:
    "Sådan køber og sælger du brugte ting live: find et show, spørg i chatten, snup med ét tryk og få det hele samlet i én pakke.",
  alternates: { canonical: "/saadan-virker-det" },
};

export default function Saadan() {
  return (
    <>
      <section className="phero" aria-labelledby="h-saadan">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Sådan virker det</span>
          </nav>
          <h1 className="h1" id="h-saadan">Sådan virker live shopping på SnupLive</h1>
          <p className="lede">
            Hele turen, fra du finder et show, til pakken ligger i postkassen.
          </p>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-buyer">
        <div className="wrap split" style={{ alignItems: "start" }}>
          <div className="sec-head">
            <span className="label mint">For købere</span>
            <h2 className="h2" id="h-buyer">Hvordan køber jeg på SnupLive?</h2>
            <p className="lede">Du behøver ikke en app. Det hele foregår her på siden, både på telefonen og computeren.</p>
            <div className="ctas"><Link className="btn btn-red" href="/live">Se hvem der er live</Link></div>
          </div>
          <ol className="steps">
            <li><div><h3>Find et show eller en ting</h3><p>Se hvem der er live under Live nu, eller find en ting, der bliver vist snart, og tryk Husk mig. Så får du en mail, når showet starter.</p></div></li>
            <li><div><h3>Spørg i chatten</h3><p>Bed sælgeren vise mærket, målene eller stoffet tæt på. Svaret kommer, mens du ser med.</p></div></li>
            <li><div><h3>Snup med ét tryk</h3><p>Den første, der trykker Snup, får tingen. Den lander med det samme under Mine snup.</p></div></li>
            <li><div><h3>Eller byd på budsalg</h3><p>Står der Budsalg på tingen, byder du i stedet for at snuppe. Du har 30 sekunder, og det højeste bud vinder.</p></div></li>
            <li><div><h3>Eller køb bagefter</h3><p>Ting, der ikke blev snuppet i showet, kommer <Link href="/til-salg">til salg</Link> til fast pris. Tryk Køb nu, så er tingen din.</p></div></li>
            <li><div><h3>Betal samlet</h3><p>Betal med MobilePay eller kort under Mine snup. Alt fra samme sælger sendes i én pakke.</p></div></li>
            <li><div><h3>Modtag din pakke</h3><p>Du bekræfter, at alt er i orden, og først derefter bliver pengene udbetalt til sælgeren.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-seller">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <span className="label red">For sælgere</span>
            <h2 className="h2" id="h-seller">Hvordan sælger jeg på SnupLive?</h2>
            <p className="lede">Opret et show, læg dine ting i køen, og gå live fra studiet.</p>
            <div className="ctas">
              <Link className="btn btn-red" href="/saelg">Læs om at sælge live</Link>
              <Link className="btn btn-line" href="/studio">Gå til studiet</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-tryg" id="tryg-handel">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="h2" id="h-tryg">Hvordan er det trygt at handle live?</h2>
          </div>
          <div className="feat">
            <div><IconUser className="ico" /><h3>Sælgere med MitID</h3><p>Ved lanceringen bliver alle sælgere verificeret med MitID, før de kan sælge.</p></div>
            <div><IconShield /><h3>Pengene holdes tilbage</h3><p>Sælgeren får først pengene, når du har modtaget dine ting.</p></div>
            <div><IconCamera /><h3>Du ser tingen live</h3><p>Bed om at se mærket, målene og standen tæt på, før du snupper.</p></div>
            <div><IconStar /><h3>Bedømmelser</h3><p>Efter hver handel kan køberen give sælgeren stjerner, så du kan se, hvem du handler med.</p></div>
            <div><IconBox /><h3>Sporing på pakken</h3><p>Du kan følge pakken fra sælgeren sender den, til den ligger i pakkeshoppen.</p></div>
            <div><IconChat /><h3>Hjælp, hvis noget går galt</h3><p>Tryk Meld et problem på ordren, inden pengene bliver udbetalt. Så holder vi pengene tilbage og hjælper jer med at finde en løsning.</p></div>
          </div>
          <p className="fine" style={{ marginTop: 18 }}>
            SnupLive er i beta. MitID for sælgere bliver slået til inden lanceringen.
          </p>
          <div className="ctas" style={{ marginTop: 24 }}><Link className="btn btn-line" href="/faq">Læs spørgsmål og svar</Link></div>
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-sortering" id="sortering">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <h2 className="h2" id="h-sortering" style={{ marginBottom: 18 }}>Sådan sorterer vi</h2>
          <ul className="sort-list">
            <li><b>Live nu:</b> de shows, der er startet senest, står først.</li>
            <li><b>Snart live og budsalg:</b> efter hvornår showet starter. Budsalg, der kører lige nu, står først.</li>
            <li><b>Til salg:</b> de ting, der senest er kommet til salg, står først.</li>
            <li><b>Kategorier og sælgere:</b> samme rækkefølge, kun med de ting, der passer.</li>
          </ul>
          <p className="muted" style={{ marginTop: 14 }}>Ingen sælger kan betale sig til en bedre plads, og vi sorterer ikke efter, hvad vi tjener.</p>
        </div>
      </section>
    </>
  );
}
