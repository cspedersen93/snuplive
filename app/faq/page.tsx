import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Spørgsmål og svar om live shopping | SnupLive" },
  description:
    "Svar på de mest stillede spørgsmål om SnupLive: snup, lynrunder, betaling, fragt, tryg handel og hvordan du går live som sælger.",
  alternates: { canonical: "/faq" },
};

const GROUPS: { title: string; qa: [string, string][] }[] = [
  {
    title: "Køb",
    qa: [
      ["Skal jeg hente en app for at købe?", "Nej. Du ser shows, chatter og snupper direkte her på siden, både på telefonen og computeren."],
      ["Hvad betyder det at snuppe noget?", "Når sælgeren viser en ting frem, kan du trykke Snup. Den første, der trykker, får tingen, og den lander med det samme under Mine snup."],
      ["Hvad er en lynrunde?", "I en lynrunde har du ti sekunder til at snuppe tingen. Sælgeren starter lynrunder, når mange vil have den samme ting."],
      ["Kan andre se, hvad jeg snupper?", "Når du snupper noget, bliver dit brugernavn vist i chatten i showet, ligesom på et loppemarked. Din liste over snup kan kun du og sælgeren se."],
    ],
  },
  {
    title: "Betaling og fragt",
    qa: [
      ["Hvordan betaler jeg?", "Under Mine snup betaler du samlet for alt, du har snuppet, med MobilePay, kort, Apple Pay eller Google Pay. Du har 3 dage til at betale."],
      ["Hvad koster fragten?", "49 kr til en DAO- eller GLS-pakkeshop, én gang pr. sælger og show, uanset hvor mange ting du snupper (op til 5 kg). Afhentning hos sælgeren er gratis."],
      ["Hvordan vælger jeg pakkeshop?", "Under Mine snup skriver du dit postnummer, vælger DAO eller GLS og den pakkeshop, du vil hente pakken i. Fragtfirmaet giver dig besked, når pakken er klar, og du kan følge den under Mine snup."],
      ["Hvornår får sælgeren pengene?", "Når du har modtaget pakken og bekræftet, at alt er i orden. Indtil da holder vi pengene tilbage. Bekræfter du ikke selv, sker det automatisk 2 dage efter, at du har hentet pakken, eller senest 7 dage efter, at den er sendt. Har du meldt et problem, venter pengene, til sagen er afgjort."],
    ],
  },
  {
    title: "Salg",
    qa: [
      ["Hvad koster det at sælge?", "Det er gratis at oprette en konto, gå live og sælge i beta-perioden. Køberen betaler en køberbeskyttelse på 5 % + 5 kr pr. pakke."],
      ["Hvad skal jeg bruge for at gå live?", "En telefon eller computer med kamera og en stabil internetforbindelse. Du går live direkte i browseren."],
      ["Skal jeg være god til at stå foran et kamera?", "Nej. De bedste shows minder om en snak ved et bord på loppemarkedet. Start med et kort show og få ting."],
    ],
  },
  {
    title: "Tryghed",
    qa: [
      ["Hvordan ved jeg, at sælgeren er til at stole på?", "Ved lanceringen bliver alle sælgere verificeret med MitID, og du kan se deres bedømmelser fra tidligere handler."],
      ["Hvad hvis tingen ikke er som vist?", "Tryk Meld et problem på ordren under Mine snup, før du bekræfter, at du har fået tingene. Så holder vi pengene tilbage, sælgeren får besked, og vi hjælper jer med at finde en løsning."],
      ["Hvad gør jeg, hvis nogen skriver grimme ting i chatten?", "Sælgeren kan fjerne beskeder og blokere brugere i sine shows. En blokeret bruger kan hverken skrive eller snuppe hos sælgeren. Ser du noget, der ikke er i orden, så skriv til kontakt@snuplive.dk."],
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
          <span className="label">Hjælp</span>
          <h1 className="h1" id="h-faq">Spørgsmål og svar om SnupLive</h1>
          <p className="lede">Her finder du svar på de spørgsmål, vi oftest får om at købe og sælge live.</p>
        </div>
      </section>
      <section className="sec tight">
        <div className="wrap faq">
          <div className="sec-head">
            <span className="label">Kan du ikke finde svaret?</span>
            <h2 className="h2">Se, hvordan det hele hænger sammen</h2>
            <p className="lede">Guiden viser hele turen for både købere og sælgere.</p>
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
