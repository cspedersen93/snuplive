import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privatlivspolitik",
  description: "Sådan behandler SnupLive dine oplysninger: hvad vi gemmer, hvorfor, hvem der hjælper os, og hvordan du får dem slettet.",
  alternates: { canonical: "/privatliv" },
};

export default function Privatliv() {
  return (
    <section className="sec tight">
      <div className="wrap" style={{ maxWidth: 780 }}>
        <nav className="crumbs" aria-label="Brødkrummer" style={{ marginBottom: 18 }}>
          <Link href="/">Forside</Link>
          <span aria-hidden="true">/</span>
          <span>Privatlivspolitik</span>
        </nav>
        <div className="prose">
          <h1 className="h2">Privatlivspolitik</h1>
          <p className="lede">Her kan du læse, hvilke oplysninger SnupLive gemmer om dig, og hvad vi bruger dem til.</p>

          <h2>Hvem er ansvarlig?</h2>
          <p>SnupLive (snuplive.dk) er dataansvarlig for de oplysninger, der bliver behandlet på siden. Du kan kontakte os på kontakt@snuplive.dk.</p>

          <h2>Hvad gemmer vi?</h2>
          <ul>
            <li><b>Konto:</b> din e-mailadresse, dit brugernavn og eventuelt navn og område, hvis du selv skriver dem.</li>
            <li><b>Shows og ting:</b> de shows og ting, du lægger op som sælger.</li>
            <li><b>Chat:</b> de beskeder, du skriver i et show. De kan ses af alle, der ser showet. Fjerner du eller sælgeren en besked, bliver teksten slettet. Blokerer en sælger dig, gemmer vi det, så du ikke kan skrive eller snuppe i sælgerens shows.</li>
            <li><b>Snup og ordrer:</b> hvad du har snuppet, hos hvem og til hvilken pris. Det kan kun du og sælgeren se. Når du snupper, bliver dit brugernavn vist i chatten.</li>
            <li><b>Betaling og levering:</b> når du betaler, får vi dit navn, din adresse og dit telefonnummer fra Stripe, og vi gemmer den pakkeshop, du vælger. Sælgeren ser dem kun for at kunne sende eller aflevere dine ting. Når sælgeren laver fragtlabelen, sender vi dit navn, din adresse, din e-mail og dit telefonnummer til Shipmondo og fragtfirmaet (DAO eller GLS), så de kan levere pakken og give dig besked. Kortoplysninger og MobilePay håndteres af Stripe, og vi ser dem aldrig.</li>
            <li><b>Problemer med en ordre:</b> melder du et problem, gemmer vi det, du skriver, og sælgeren kan læse det. Vi bruger det kun til at afgøre sagen.</li>
            <li><b>Sælgere:</b> for at få udbetalt penge opretter du en konto hos Stripe, som tjekker din identitet og bankkonto. Din afsenderadresse står på fragtlabelen og deles med Shipmondo og fragtfirmaet.</li>
            <li><b>Video:</b> videoen fra et live-show bliver sendt direkte til seerne og bliver ikke gemt.</li>
          </ul>

          <h2>Hvorfor?</h2>
          <p>Vi bruger oplysningerne til at levere tjenesten: logge dig ind, vise shows, chat og dine snup. Grundlaget er aftalen mellem dig og os, når du opretter en konto.</p>

          <h2>Hvem hjælper os?</h2>
          <p>Vi bruger databehandlere til drift: Supabase (database og login), LiveKit (video), Vercel (hosting), Stripe (betaling og udbetaling), Shipmondo (fragtlabels og sporing) og Resend (login-mails). De må kun bruge oplysningerne til at hjælpe os.</p>

          <h2>Cookies</h2>
          <p>Vi bruger kun de cookies, der er nødvendige for, at du kan være logget ind. Vi bruger ikke cookies til reklame eller sporing, og vores skrifttyper hentes fra vores egen server.</p>

          <h2>Dine rettigheder</h2>
          <p>Du kan altid få indsigt i, rette eller slette dine oplysninger. Skriv til kontakt@snuplive.dk, så sletter vi din konto og dine oplysninger. Du kan også klage til Datatilsynet.</p>

          <p className="fine">Senest opdateret oktober 2026. SnupLive er i beta, og politikken bliver opdateret, når betaling åbner.</p>
        </div>
      </div>
    </section>
  );
}
