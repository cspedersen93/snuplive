import type { Metadata } from "next";
import Link from "next/link";
import CompanyInfo from "@/components/CompanyInfo";
import LegalPage from "@/components/LegalPage";
import ReuseCounter from "@/components/ReuseCounter";
import SupportLink from "@/components/SupportLink";
import { COMPANY } from "@/lib/company";
import { reusedCount } from "@/lib/reuse";

export const metadata: Metadata = {
  title: { absolute: "Om Relived: second hand, du kan se live" },
  description: "Relived er en dansk markedsplads, hvor brugte varer bliver vist frem live på video. Læs, hvorfor vi har lavet den, og hvem der står bag.",
  alternates: { canonical: "/om-relived" },
};

export const revalidate = 300;

export default async function OmRelived() {
  const reused = await reusedCount();
  return (
    <LegalPage title="Om Relived: en dansk second hand markedsplads, hvor du ser varen først" crumb="Om Relived" updated="november 2026">
      <p className="lede">
        Relived er loppemarkedet, du kan gå på fra sofaen. Sælgeren står bag boden og viser varen frem, du spørger, og du køber,
        når du har set nok.
      </p>

      <h2>Hvorfor har vi lavet Relived?</h2>
      <p>
        Brugte varer har en historie, og de koster mindre end nye. Men når du kun har et par billeder at gå ud fra, køber du
        halvt i blinde. Kjolen er en anden farve i virkeligheden, og stolen har en ridse, som ikke var med på billedet.
      </p>
      <p>
        Det ville vi lave om. På et loppemarked tager du varen i hånden, vender den og spørger sælgeren. Det samme sker på
        Relived, bare på video. <Link href="/saadan-virker-det">Se, hvordan det virker</Link>.
      </p>
      <ReuseCounter n={reused} />

      <h2>Hvad tror vi på?</h2>
      <ul>
        <li><b>Se, før du køber.</b> Video viser det, billeder skjuler.</li>
        <li><b>Tal med sælgeren.</b> Et hurtigt svar i chatten sparer en returpakke.</li>
        <li><b>Pengene venter.</b> Sælgeren får dem først, når køberen har varen.</li>
        <li><b>Det skal være sjovt.</b> Et godt fund er sjovere, når man er flere om at se det.</li>
      </ul>

      <h2>Hvem står bag?</h2>
      <p>Relived er lavet i Hvidovre af Casper Pedersen og Kasper Vahlgren.</p>
      <p>
        <Link className="btn btn-red" href="/live">Se hvem der er live</Link>{" "}
        <Link className="btn btn-line" href="/saadan-virker-det">Sådan virker det</Link>
      </p>

      <h2>Hvordan kontakter jeg Relived?</h2>
      <p>
        Skriv til os i chatten (<SupportLink className="sup-link inline">åbn chatten</SupportLink>, eller tryk <b>Hjælp</b> nederst på
        siden), eller send en mail til <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        Gælder det en ordre, så brug <b>Meld et problem</b> på ordren under Mine køb. Vil du anmelde en vare, et show eller en
        profil, så tryk <b>Anmeld</b> ved den.
      </p>

      <h2>Firmaoplysninger</h2>
      <CompanyInfo />

      <h2>Regler</h2>
      <ul>
        <li><Link href="/handelsbetingelser">Handelsbetingelser for købere</Link></li>
        <li><Link href="/vilkaar">Vilkår for brugere og sælgere</Link></li>
        <li><Link href="/privatliv">Privatlivspolitik</Link></li>
      </ul>
    </LegalPage>
  );
}
