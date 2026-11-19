import type { Metadata } from "next";
import Link from "next/link";
import CompanyInfo from "@/components/CompanyInfo";
import LegalPage from "@/components/LegalPage";
import ReuseCounter from "@/components/ReuseCounter";
import SupportLink from "@/components/SupportLink";
import { COMPANY } from "@/lib/company";
import { reusedCount } from "@/lib/reuse";
import { og } from "@/lib/og";
import JsonLd, { crumbsLd, orgLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Om Relived og kontakt",
  description: "Relived er en dansk markedsplads, hvor brugt tøj og andre varer bliver solgt live på video. Læs, hvorfor vi har lavet den, og hvordan du kontakter os.",
  alternates: { canonical: "/om-relived" },
  openGraph: og("/om-relived"),
};

export const revalidate = 300;

export default async function OmRelived() {
  const reused = await reusedCount();
  return (
    <LegalPage title="Om Relived og kontakt" crumb="Om Relived" updated="november 2026">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "AboutPage", url: `${SITE_URL}/om-relived`, name: "Om Relived og kontakt", inLanguage: "da-DK", mainEntity: { "@id": `${SITE_URL}/#organisation` } },
            orgLd(),
            crumbsLd([["Forside", "/"], ["Om Relived", "/om-relived"]]),
          ],
        }}
      />
      <p className="lede">
        Relived er en dansk markedsplads for brugte varer. Sælgerne viser varerne frem på video, og køberne køber med ét tryk, byder
        eller køber bagefter til fast pris.
      </p>

      <h2>Hvorfor Relived?</h2>
      <p>
        Brugte varer har en historie, de er billigere end nye, og de fortjener et liv mere. Men det er svært at vide, hvad man
        får, når man kun har et par billeder at gå ud fra.
      </p>
      <p>
        Derfor har vi lavet Relived. Her viser sælgeren varen frem på video, du kan spørge om alt, og sælgeren får først pengene,
        når du har varen i hånden. Lidt som et loppemarked, bare fra sofaen. <Link href="/saadan-virker-det">Se, hvordan det virker</Link>.
      </p>
      <ReuseCounter n={reused} />

      <h2>Kontakt</h2>
      <p>
        Skriv til os i chatten (<SupportLink className="sup-link inline">åbn chatten</SupportLink>, eller tryk <b>Hjælp</b> nederst på
        siden), eller send en mail til <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Du kan også ringe til os på{" "}
        <a href={COMPANY.phoneHref}>{COMPANY.phone}</a>. Gælder det en ordre, så brug <b>Meld et problem</b> på
        ordren under Mine køb. Vil du anmelde en vare, et show eller en profil, så tryk <b>Anmeld</b> ved den.
      </p>

      <h2>Firmaoplysninger</h2>
      <CompanyInfo phone />

      <h2>Regler</h2>
      <ul>
        <li><Link href="/handelsbetingelser">Handelsbetingelser for købere</Link></li>
        <li><Link href="/vilkaar">Vilkår for brugere og sælgere</Link></li>
        <li><Link href="/privatliv">Privatlivspolitik</Link></li>
      </ul>
    </LegalPage>
  );
}
