import type { Metadata } from "next";
import Link from "next/link";
import CompanyInfo from "@/components/CompanyInfo";
import LegalPage from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";
import { RESERVATION_DAYS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Vilkår for brugere og sælgere",
  description:
    "Vilkår for at bruge og sælge på Relived: konto, regler for ting og shows, anmeldelser, gebyrer, udbetaling og indberetning til Skattestyrelsen.",
  alternates: { canonical: "/vilkaar" },
};

export default function Vilkaar() {
  return (
    <LegalPage title="Vilkår for brugere og sælgere" crumb="Vilkår" updated="oktober 2026">
      <p className="lede">
        Vilkårene gælder for alle, der bruger Relived. Del B gælder også for sælgere. Når du køber, gælder også{" "}
        <Link href="/handelsbetingelser">handelsbetingelserne</Link>.
      </p>
      <CompanyInfo />

      <h2>Del A: For alle</h2>

      <h3>1. Din konto</h3>
      <p>
        Du skal være fyldt 18 år for at købe og sælge. Du logger ind med din e-mail og må kun have én konto. Du er ansvarlig for det,
        der sker på din konto, og dit brugernavn må ikke udgive sig for at være en anden.
      </p>

      <h3>2. Regler for ting, shows og chat</h3>
      <p>Det er ikke tilladt at sælge eller vise:</p>
      <ul>
        <li>ulovlige, stjålne eller forfalskede ting (kopivarer)</li>
        <li>våben, medicin, tobak, alkohol, levende dyr og fødevarer</li>
        <li>ting, der er farlige eller kaldt tilbage</li>
        <li>nøgenhed, vold, chikane, trusler eller hadefulde udtalelser i shows og chat</li>
      </ul>
      <p>Køb og salg skal ske gennem Relived. Du må ikke bede andre om at betale uden om siden.</p>

      <h3>3. Anmeld noget, der ikke er i orden</h3>
      <p>
        Alle kan anmelde en ting, et show eller en profil med knappen <b>Anmeld</b>, også uden at være logget ind. Vi læser alle
        anmeldelser og fjerner det, der er ulovligt eller strider mod vilkårene. Fjerner vi noget, får den, der lagde det op, besked
        om hvorfor. Er du uenig i en afgørelse, kan du skrive til {COMPANY.email}, så ser vi på den igen.
      </p>
      <p>Bryder en bruger vilkårene flere gange eller groft, kan vi lukke kontoen.</p>

      <h3>4. Bedømmelser</h3>
      <p>
        Når en handel er afsluttet, kan køberen give sælgeren 1–5 stjerner og en kort kommentar. Bedømmelsen kan ses af alle sammen
        med køberens brugernavn. Bedømmelser skal være ærlige og handle om selve handlen. Vi fjerner bedømmelser, der er krænkende
        eller ikke handler om handlen.
      </p>

      <h3>5. Sådan sorterer vi tingene</h3>
      <p>
        Ingen sælger kan betale sig til en bedre plads. Læs mere under{" "}
        <Link href="/saadan-virker-det#sortering">Sådan sorterer vi</Link>.
      </p>

      <h2>Del B: For sælgere</h2>

      <h3>6. Privat eller erhverv</h3>
      <p>
        Når du bliver sælger, oplyser du, om du sælger som privatperson eller som virksomhed. Køberne kan se det ved dine ting og shows.
        Sælger du ting, du har købt for at sælge dem videre, eller sælger du jævnligt for at tjene penge, er du erhvervsdrivende og
        skal vælge erhverv med firmanavn og CVR-nummer. Som erhvervssælger skal du overholde reglerne om fortrydelsesret og
        reklamation, og dine priser skal være med moms, hvis du er momsregistreret.
      </p>
      <p>
        Vi kan bede dig bekræfte, hvem du er, med MitID, før du går live. Du skal være fyldt 18 år, og det samme MitID må kun bruges
        på én sælgerkonto. Køberne ser mærket MitID-bekræftet ved dine ting og shows.
      </p>

      <h3>7. Dine ting</h3>
      <ul>
        <li>Du må kun sælge ting, du ejer, og som må sælges.</li>
        <li>Beskriv tingen ærligt, og vis fejl og slid tydeligt på video.</li>
        <li>Prisen, du sætter, og et vindende bud er bindende for dig.</li>
        <li>Send pakken inden 3 hverdage efter, at køberen har betalt, eller aftal afhentning med køberen.</li>
      </ul>

      <h3>8. Gebyrer</h3>
      <p>
        Det er gratis at sælge, mens Relived er i beta. Køberen betaler køberbeskyttelsen. Indfører vi et salgsgebyr, får du besked,
        før det gælder.
      </p>

      <h3>9. Betaling og udbetaling</h3>
      <p>
        For at få penge for dine salg opretter du en konto hos Stripe, som tjekker din identitet og din bankkonto. Stripes egne
        vilkår gælder for den konto. Pengene bliver sendt til din bankkonto, når køberen har fået tingene. Har køberen meldt et
        problem, venter pengene, til sagen er afgjort. Betaler køberen ikke inden {RESERVATION_DAYS} dage, bliver købet annulleret, og
        tingen kan sælges igen.
      </p>

      <h3>10. Skat og indberetning til Skattestyrelsen</h3>
      <p>
        Relived skal efter reglerne om digitale platforme (DAC7) hvert år indberette sælgere, der har mindst 30 salg eller har solgt
        for mere end 2.000 euro i løbet af året. Vi indberetter navn, adresse, CPR- eller CVR-nummer, fødselsdato, bankkonto og dine
        salg pr. kvartal. Nærmer du dig grænsen, beder vi dig om de oplysninger, vi mangler. Du er selv ansvarlig for at betale den
        skat, der skal betales af dine salg.
      </p>

      <h3>11. Hvis vi lukker en konto eller fjerner en ting</h3>
      <p>
        Vi kan fjerne en ting eller lukke en sælgerkonto, hvis vilkårene bliver brudt. Du får besked om hvorfor. Ordrer, der allerede
        er betalt, bliver gjort færdige eller refunderet.
      </p>

      <h2>Del C: Det sidste</h2>
      <h3>12. Ændringer, ophør og lovvalg</h3>
      <p>
        Vi kan ændre vilkårene og giver besked på siden eller på mail, før større ændringer gælder. Du kan altid slette din konto ved at
        skrive til {COMPANY.email}. Dansk ret gælder.
      </p>
    </LegalPage>
  );
}
