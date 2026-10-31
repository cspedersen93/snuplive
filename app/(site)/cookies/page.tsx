import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";
import { COOKIES, LOCAL, type StoredThing } from "@/lib/cookies";
import ForgetChoices from "./ForgetChoices";

export const metadata: Metadata = {
  title: "Cookies: kun det, der skal til",
  description: "Relived bruger kun nødvendige cookies, så du kan logge ind, købe og sælge. Ingen cookies til reklame, statistik eller sporing. Se listen her.",
  alternates: { canonical: "/cookies" },
};

function Table({ rows, caption }: { rows: StoredThing[]; caption: string }) {
  return (
    <div className="table-wrap cookie-table">
      <table className="dtable">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Navn</th>
            <th scope="col">Hvad den gør</th>
            <th scope="col">Hvor længe</th>
            <th scope="col">Hvem</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td><code>{r.name}</code></td>
              <td>{r.what}</td>
              <td>{r.how_long}</td>
              <td>{r.who}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Cookies() {
  return (
    <LegalPage title="Cookies på Relived" crumb="Cookies" updated="31. oktober 2026">
      <p className="lede">
        Kort fortalt: Relived bruger kun de cookies, der skal til, for at du kan logge ind, købe og sælge. Vi bruger ingen cookies
        til reklame, statistik eller sporing, og vi deler ikke noget med annoncører.
      </p>

      <h2>Hvorfor bliver jeg ikke spurgt om lov?</h2>
      <p>
        Cookies, der er nødvendige for, at siden virker, eller som husker et valg, du selv har truffet, må bruges uden samtykke.
        Det står i cookiebekendtgørelsen. Vi skal fortælle dig, hvad vi gemmer, og det gør vi her. Begynder vi en dag at bruge
        cookies til statistik eller reklame, spørger vi dig først, og du kan sige nej.
      </p>

      <h2>Hvilke cookies bruger vi?</h2>
      <Table rows={COOKIES} caption="Cookies på relived.dk" />

      <h2>Hvad gemmer vi i din browser?</h2>
      <p>
        Nogle valg husker din browser selv (i det, der hedder localStorage). Det bliver på din enhed og bliver ikke sendt til os.
      </p>
      <Table rows={LOCAL} caption="Gemt i din browser" />

      <h2>Hvad med betaling, MitID og video?</h2>
      <ul>
        <li>
          <b>Betaling:</b> når du betaler, kommer du over på Stripes betalingsside. Den bruger sine egne cookies, så betalingen er
          sikker. Se <a href="https://stripe.com/cookies-policy/legal" rel="noopener noreferrer" target="_blank">Stripes cookiepolitik</a>.
        </li>
        <li>
          <b>MitID:</b> når en sælger bekræfter sig, sker det på MitID&apos;s egen side, som bruger sine egne cookies.
        </li>
        <li>
          <b>Video:</b> live-videoen bruger ingen cookies. Kamera og mikrofon bliver kun brugt, når du selv tænder dem i studiet.
        </li>
        <li>
          <b>Besked på telefonen:</b> slår du det til, gemmer vi en adresse til din telefon, så vi kan sende beskeden. Du kan slå
          det fra under Min konto eller i browseren.
        </li>
        <li>
          <b>Skrifttyper og billeder</b> kommer fra vores egen server, så andre firmaer ikke kan se, at du er her.
        </li>
        <li>
          <b>Statistik:</b> vi tæller besøg med Vercel Web Analytics. Det sker uden cookies, og der bliver ikke gemt noget i din
          browser. Vi kan se, hvilke sider der bliver besøgt, hvilken side de besøgende kom fra (fx Google), og hvilken type enhed
          og land det er, men ikke hvem du er. Sider med login, Min konto, Mine køb og studiet tæller vi ikke.
        </li>
      </ul>

      <h2>Sådan sletter du cookies og dine valg</h2>
      <p>
        Du kan slette cookies i din browsers indstillinger. Sletter du login-cookien, bliver du logget ud. Vil du bare have siden
        til at glemme dine valg (fx din pakkeshop), så tryk her:
      </p>
      <ForgetChoices />

      <h2>Spørgsmål?</h2>
      <p>
        Skriv til {COMPANY.email}. Hvordan vi ellers passer på dine oplysninger, kan du læse i vores{" "}
        <Link href="/privatliv">privatlivspolitik</Link>.
      </p>
    </LegalPage>
  );
}
