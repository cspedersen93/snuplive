import type { Metadata } from "next";
import Link from "next/link";
import CompanyInfo from "@/components/CompanyInfo";
import LegalPage from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Privatlivspolitik",
  description: "Sådan behandler Relived dine oplysninger: hvad vi gemmer, hvorfor, hvem der hjælper os, og hvordan du får dem slettet.",
  alternates: { canonical: "/privatliv" },
};

export default function Privatliv() {
  return (
    <LegalPage title="Privatlivspolitik" crumb="Privatlivspolitik" updated="oktober 2026">
      <p className="lede">Her kan du læse, hvilke oplysninger Relived gemmer om dig, og hvad vi bruger dem til.</p>

      <h2>Hvem er ansvarlig?</h2>
      <p>Relived er dataansvarlig for de oplysninger, der bliver behandlet på relived.dk.</p>
      <CompanyInfo />

      <h2>Hvad gemmer vi?</h2>
      <ul>
        <li><b>Venteliste:</b> skriver du dig op, før Relived åbner, gemmer vi din e-mail, om du vil købe eller sælge, og hvornår du sagde ja til mails og bekræftede. Vi bruger den kun til at give dig besked, når vi åbner, og til nyheder om Relived. Hver mail har et link til afmelding. Afmelder du dig, sender vi ikke flere mails, og vi gemmer kun, at du er afmeldt.</li>
        <li><b>Konto:</b> din e-mailadresse, dit brugernavn og eventuelt navn, område og profilbillede, hvis du selv lægger dem ind.</li>
        <li><b>Shows og ting:</b> de shows og ting, du lægger op som sælger, med billeder og beskrivelser. De kan ses af alle.</li>
        <li><b>Sælgeroplysninger:</b> om du sælger som privatperson eller virksomhed. Sælger du som virksomhed, vises firmanavn og CVR-nummer ved dine ting.</li>
        <li><b>Chat:</b> de beskeder, du skriver i et show. De kan ses af alle, der ser showet. Fjerner du eller sælgeren en besked, bliver teksten slettet. Blokerer en sælger dig, gemmer vi det, så du ikke kan skrive, købe eller byde i sælgerens shows.</li>
        <li><b>Køb, bud og ordrer:</b> hvad du har købt og budt på, hos hvem og til hvilken pris. Når du køber eller vinder et budsalg, bliver dit brugernavn vist i chatten, og under et budsalg kan alle se brugernavnet på den, der har det højeste bud.</li>
        <li><b>Husk mig og Følg:</b> hvilke ting og shows du har bedt om besked om, og hvilke sælgere du følger. Sælgerne kan se, hvor mange der følger dem, men ikke hvem.</li>
        <li id="aegthed"><b>Ægthedstjek:</b> sender du en mærkevare til ægthedstjek, gemmer vi dine nærbilleder af tingen, og hvem der godkendte eller afviste den. Billederne bruger vi kun til tjekket, og de bliver ikke vist på siden.</li>
        <li id="besked"><b>Besked på telefonen:</b> slår du det til, gemmer vi en adresse fra din browser, så vi kan sende beskeder til den. Beskeden går gennem browserens egen tjeneste (fx Google, Apple eller Mozilla). Du kan slå det fra under Min konto eller i browseren.</li>
        <li><b>Betaling og levering:</b> når du betaler, får vi dit navn, din adresse og dit telefonnummer fra Stripe, og vi gemmer den pakkeshop, du vælger. Sælgeren ser dem kun for at kunne sende eller aflevere dine ting. Når sælgeren laver fragtlabelen, sender vi dit navn, din adresse, din e-mail og dit telefonnummer til Shipmondo og fragtfirmaet (DAO eller GLS). Kortoplysninger og MobilePay håndteres af Stripe, og vi ser dem aldrig.</li>
        <li><b>Bedømmelser:</b> giver du en sælger stjerner og en kommentar, kan alle se den sammen med dit brugernavn.</li>
        <li id="support"><b>Supportchat:</b> skriver du til os i chatten, gemmer vi dine beskeder og vores svar, din e-mail (eller din konto, hvis du er logget ind), hvilken side du var på, og hvilken browser og enhed du brugte, så vi kan finde fejlen. Svarer vi, mens du ikke er på siden, sender vi svaret til din e-mail. For at stoppe spam gemmer vi et fingeraftryk af din IP-adresse (ikke selve adressen) i to døgn.</li>
        <li><b>Problemer og anmeldelser:</b> melder du et problem med en ordre, kan sælgeren læse det, du skriver. Anmelder du noget, gemmer vi anmeldelsen og eventuelt din e-mail, så vi kan svare dig. Vi siger ikke til den anmeldte, hvem der har anmeldt.</li>
        <li><b>MitID:</b> når du som sælger bekræfter dig med MitID, får vi dit navn, din fødselsdato og et id fra MitID gennem Idura. Vi gemmer navn, fødselsdato, tidspunktet og et fingeraftryk af id&apos;et (ikke selve id&apos;et), så det samme MitID ikke kan bruges på flere konti. Vi får ikke dit CPR-nummer. Køberne kan kun se, at du er MitID-bekræftet.</li>
        <li><b>Sælgere og udbetaling:</b> for at få udbetalt penge opretter du en konto hos Stripe, som tjekker din identitet og bankkonto. Din afsenderadresse står på fragtlabelen og deles med Shipmondo og fragtfirmaet.</li>
        <li id="video"><b>Video:</b> videoen fra et live-show bliver sendt direkte til seerne. Når sælgeren viser en ting frem, tager vi nogle stillbilleder og gemmer det, hvor tingen ses bedst, og et klip på op til 15 sekunder med lyd. For at finde det bedste billede sender vi små udgaver af stillbillederne til Anthropic (Claude), som kun bruges til at vælge billedet. Bliver tingen ikke solgt i showet, vises klippet på tingens side, hvor alle kan se det. Sælgeren kan slette klippet, og vi sletter det 14 dage efter, at tingen er solgt, eller når tingen bliver fjernet. Resten af showet gemmer vi ikke. Lægger en sælger en videoannonce op, gemmer vi videoen (højst 45 sekunder med lyd) og de billeder, sælgeren vælger, på samme måde. Billederne findes i videoen på sælgerens telefon, og små udgaver sendes til Anthropic (Claude), som kun bruges til at vælge de bedste.</li>
      </ul>

      <h2>Hvorfor, og hvor længe?</h2>
      <p>
        Vi bruger oplysningerne til at levere tjenesten: logge dig ind, vise shows og ting, håndtere køb, betaling, fragt og problemer.
        Grundlaget er aftalen mellem dig og os. Ordrer og betalinger gemmer vi i 5 år, fordi bogføringsloven kræver det, også hvis du
        sletter din konto. Resten sletter vi, når du sletter din konto. Samtaler i supportchatten sletter vi 12 måneder efter den
        sidste besked, så vi kan hjælpe, hvis problemet kommer igen. Grundlaget for dem er vores interesse i at kunne svare dig.
      </p>

      <h2>Indberetning til Skattestyrelsen</h2>
      <p>
        Har du som sælger mindst 30 salg eller sælger du for mere end 2.000 euro på et år, skal vi indberette dig til
        Skattestyrelsen efter reglerne om digitale platforme (DAC7). Det omfatter navn, adresse, CPR- eller CVR-nummer, fødselsdato,
        bankkonto og dine salg pr. kvartal. Grundlaget er en retlig forpligtelse.
      </p>

      <h2>Hvem hjælper os?</h2>
      <p>
        Vi bruger databehandlere til drift: Supabase (database og login), LiveKit (video), Vercel (hosting), Stripe (betaling og
        udbetaling), Shipmondo (fragtlabels og sporing), Resend (mails), Idura (MitID) og Anthropic (valg af billedet af tingene). De må kun bruge oplysningerne til at hjælpe os.
      </p>

      <h2>Cookies</h2>
      <p>
        Vi bruger kun de cookies, der er nødvendige for, at du kan være logget ind, betale og fortsætte en samtale i supportchatten.
        Har du skrevet til os, husker din browser det, så du kan se, når vi har svaret. Vi bruger ikke cookies til reklame eller
        sporing, og vores skrifttyper hentes fra vores egen server. Se hele listen under{" "}
        <Link href="/cookies">cookies</Link>.
      </p>

      <h2>Dine rettigheder</h2>
      <p>
        Du kan altid få indsigt i, rette eller slette dine oplysninger. Skriv til {COMPANY.email}. Du kan også klage til
        Datatilsynet (datatilsynet.dk).
      </p>
    </LegalPage>
  );
}
