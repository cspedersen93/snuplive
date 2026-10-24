import type { Metadata } from "next";
import Link from "next/link";
import CompanyInfo from "@/components/CompanyInfo";
import LegalPage from "@/components/LegalPage";
import SupportLink from "@/components/SupportLink";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Om SnupLive og kontakt",
  description: "SnupLive er en dansk markedsplads, hvor brugt tøj og ting bliver solgt live på video. Her finder du firmaoplysninger og kontakt.",
  alternates: { canonical: "/om-snuplive" },
};

export default function OmSnupLive() {
  return (
    <LegalPage title="Om SnupLive og kontakt" crumb="Om SnupLive" updated="oktober 2026">
      <p className="lede">
        SnupLive er en dansk markedsplads for brugte ting. Sælgerne viser tingene frem på video, og køberne snupper, byder eller
        køber bagefter til fast pris.
      </p>

      <h2>Kontakt</h2>
      <p>
        Skriv til os i chatten (<SupportLink className="sup-link inline">åbn chatten</SupportLink>, eller tryk <b>Hjælp</b> nederst på
        siden), eller send en mail til <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Gælder det en ordre, så brug <b>Meld et problem</b> på
        ordren under Mine snup. Vil du anmelde en ting, et show eller en profil, så tryk <b>Anmeld</b> ved den.
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
