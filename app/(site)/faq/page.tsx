import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Spørgsmål og svar om live shopping | Relived" },
  description:
    "Svar på de mest stillede spørgsmål om Relived: køb i live-shows, lynrunder, betaling, fragt, tryg handel og hvordan du går live som sælger.",
  alternates: { canonical: "/faq" },
};

const GROUPS: { title: string; qa: [string, string][] }[] = [
  {
    title: "Køb",
    qa: [
      ["Hvad er Relived?", "Relived er en dansk markedsplads for brugt tøj og andre varer, hvor sælgerne viser varerne frem live på video. Du kan spørge sælgeren i chatten, købe med ét tryk eller byde på budsalg, og det, der ikke bliver solgt, kan købes bagefter til fast pris."],
      ["Skal jeg hente en app for at købe?", "Nej. Du ser shows, chatter og køber direkte her på siden, både på telefonen og computeren."],
      ["Hvordan køber jeg i et live-show?", "Når sælgeren viser en vare frem, kan du trykke Køb. Den første, der trykker, får varen, og den lander med det samme under Mine køb."],
      ["Hvad betyder Husk mig?", "Sælgerne kan lægge deres varer på Relived før showet. Trykker du Husk mig på en vare eller et show, giver vi dig besked, når showet starter. Du kan købe varen, mens den bliver vist live."],
      ["Hvordan ved jeg, at en designertaske er ægte?", "Mærkevarer som Louis Vuitton, Gucci, Chanel, Hermès og Rolex og varer i kategorien Luksus til 1.000 kr eller mere skal ægthedstjekkes af Relived, før de kan vises live eller købes. Sælgeren sender nærbilleder af logo, serie- eller datokode, foer og syninger, og vi godkender dem. Godkendte varer har mærket Ægthed tjekket. Viser en vare sig alligevel at være falsk, trykker du Meld et problem under Mine køb og vælger Varen er falsk. Så får du alle pengene tilbage."],
      ["Kan jeg sælge makeup og parfume?", "Ja, i kategorien Skønhed, men kun hvis produktet er nyt og uåbnet. Brugt makeup og hudpleje må ikke sælges af hensyn til hygiejnen."],
      ["Hvad er Klip?", "Under Klip kan du swipe gennem korte videoer af varer, der er til salg (fra live-showene og videoannoncer), ligesom på de sociale medier. Du ser varen med lyd og billede, og du kan købe den eller følge sælgeren direkte fra klippet."],
      ["Hvordan får jeg besked, når en sælger går live?", "Tryk Følg på sælgerens side, ved showet eller ved en vare. Så giver vi dig besked, hver gang sælgeren går live, og om morgenen, hvis sælgeren har et show samme dag. Slår du besked på telefonen til, kommer beskeden dér. Ellers får du en mail. Under Min konto kan du se, hvem du følger."],
      ["Hvad er Køb nu?", "Varer, der ikke bliver solgt i et live-show, og videoannoncer kan købes til fast pris. På varens side kan du se den på video. Tryk Køb nu, så er den din, og du betaler under Mine køb."],
      ["Hvordan virker budsalg?", "Nogle varer sælges på budsalg. Buddene starter ved startprisen, og når sælgeren starter budsalget, har du 30 sekunder til at byde. Hvert bud er et fast trin højere: 5 kr under 100 kr, 10 kr op til 500 kr, 25 kr op til 1.000 kr og 50 kr derover. Byder nogen i de sidste 10 sekunder, får alle 10 sekunder mere. Det højeste bud vinder."],
      ["Er mit bud bindende?", "Ja. Vinder du budsalget, lander varen under Mine køb til dit bud, og du betaler inden 3 dage, ligesom når du køber med det samme. Byder ingen, kan varen købes bagefter til startprisen."],
      ["Hvad er en lynrunde?", "I en lynrunde har du ti sekunder til at købe varen. Sælgeren starter lynrunder, når mange vil have den samme vare."],
      ["Kan jeg sende hjerter i et live-show?", "Ja. Tryk på hjertet i højre side af videoen, eller tryk to gange på videoen. Under smileyen finder du flere emojis og store effekter som konfetti, hjerteregn og stjerneskud. Hjerter og emojis kan alle sende. Store effekter kræver, at du er logget ind, for dit brugernavn bliver vist, og du kan sende én hvert 30. sekund."],
      ["Kan andre se, hvad jeg køber?", "Når du køber noget, bliver dit brugernavn vist i chatten i showet, ligesom på et loppemarked. Din liste over køb kan kun du og sælgeren se."],
    ],
  },
  {
    title: "Betaling og fragt",
    qa: [
      ["Hvad koster det at købe?", "Du betaler prisen på varen, fragten og en køberbeskyttelse på 5 % af varerne + 5 kr pr. pakke. Med køberbeskyttelsen holder vi pengene tilbage, til du har fået varen, og vi hjælper dig, hvis noget går galt. Du kan se den samlede pris, før du betaler."],
      ["Hvordan betaler jeg?", "Under Mine køb betaler du samlet for alt, du har købt, med MobilePay, kort, Apple Pay eller Google Pay. Du har 3 dage til at betale."],
      ["Hvad hvis jeg køber hos flere sælgere i samme show?", "Nogle shows har gæster, så flere sælgere sælger sammen. Ved hver vare står, hvem der sælger den. Køber du hos flere af dem, får du en pakke fra hver sælger, og fragten betales pr. pakke."],
      ["Hvad koster fragten?", "49 kr til en DAO- eller GLS-pakkeshop, én gang pr. sælger, uanset hvor mange varer du køber hos sælgeren (op til 5 kg). Afhentning hos sælgeren er gratis."],
      ["Hvordan vælger jeg pakkeshop?", "Under Mine køb skriver du dit postnummer, vælger DAO eller GLS og den pakkeshop, du vil hente pakken i. Fragtfirmaet giver dig besked, når pakken er klar, og du kan følge den under Mine køb."],
      ["Hvornår får sælgeren pengene?", "Når du har modtaget pakken og bekræftet, at alt er i orden. Indtil da holder vi pengene tilbage. Bekræfter du ikke selv, sker det automatisk 2 dage efter, at du har hentet pakken, eller senest 7 dage efter, at den er sendt. Har du meldt et problem, venter pengene, til sagen er afgjort."],
    ],
  },
  {
    title: "Salg",
    qa: [
      ["Hvad koster det at sælge?", "Det er gratis at oprette en konto, gå live og sælge i beta-perioden. Køberen betaler en køberbeskyttelse på 5 % + 5 kr pr. pakke."],
      ["Hvad skal jeg bruge for at gå live?", "En telefon eller computer med kamera og en stabil internetforbindelse. Du går live direkte i browseren."],
      ["Skal jeg være god til at stå foran et kamera?", "Nej. De bedste shows minder om en snak ved et bord på loppemarkedet. Start med et kort show og få varer."],
      ["Kan vi være flere sælgere i samme show?", "Ja. I studiet trykker du Inviter en sælger og sender linket til en anden sælger. Op til 2 gæster kan være med. I er på kameraet sammen, og gæsterne lægger deres egne varer i køen. Pengene for en gæsts varer går til gæsten, og gæsten sender selv sine varer. Du styrer showet: hvad der vises, budsalg, lynrunder og chatten. Følgerne af gæsterne får også besked, når showet går live."],
      ["Kan jeg holde mit show på engelsk?", "Ja. Sæt flueben i Showet er på engelsk, når du opretter showet, eller tryk English øverst i studiet. Så får showet mærket English, og det kommer med på siden Relived in English, hvor engelsktalende købere kan finde det."],
      ["Kan jeg sælge uden at gå live?", "Ja. Under Mine shows trykker du Sælg med video og filmer varen i op til 45 sekunder med telefonens kamera. Du skal ikke selv være med. Vi finder billederne i videoen, du skriver pris og stand, og så kan varen købes med det samme med Køb nu. Videoen vises på annoncen og under Klip."],
    ],
  },
  {
    title: "Tryghed",
    qa: [
      ["Hvordan ved jeg, at sælgeren er til at stole på?", "Du kan se sælgerens stjerner fra tidligere handler ved sælgerens navn, og om sælgeren er privat eller en virksomhed. Ved lanceringen bliver alle sælgere også verificeret med MitID."],
      ["Hvad hvis varen ikke er som vist?", "Tryk Meld et problem på ordren under Mine køb, før du bekræfter, at du har fået varerne. Så holder vi pengene tilbage, sælgeren får besked, og vi hjælper jer med at finde en løsning."],
      ["Hvad gør jeg, hvis nogen skriver grimme ting i chatten?", "Sælgeren kan fjerne beskeder og blokere brugere i sine shows. En blokeret bruger kan hverken skrive eller købe hos sælgeren. Ser du noget, der ikke er i orden, så skriv til kontakt@relived.dk."],
    ],
  },
];

export default function Faq() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((g) =>
      g.qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    ),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="phero" aria-labelledby="h-faq">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Spørgsmål og svar</span>
          </nav>
          <h1 className="h1" id="h-faq">Spørgsmål og svar om Relived</h1>
        </div>
      </section>
      <section className="sec tight">
        <div className="wrap faq">
          <div className="sec-head">
            <span className="label">Kan du ikke finde svaret?</span>
            <h2 className="h2">Se, hvordan det hele hænger sammen</h2>
            <div className="ctas">
              <Link className="btn btn-line" href="/saadan-virker-det">Sådan virker det</Link>
              <Link className="btn btn-red" href="/opret">Opret gratis konto</Link>
            </div>
          </div>
          <div>
            {GROUPS.map((g, gi) => (
              <div className="faq-group" key={g.title}>
                <h2>{g.title}</h2>
                <div className="faq-list">
                  {g.qa.map(([q, a], i) => (
                    <details key={q} open={gi === 0 && i === 0}>
                      <summary>
                        <h3>{q}</h3>
                        <span className="pm" aria-hidden="true">+</span>
                      </summary>
                      <p>{a}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
