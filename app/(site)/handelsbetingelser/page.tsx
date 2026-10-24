import type { Metadata } from "next";
import Link from "next/link";
import CompanyInfo from "@/components/CompanyInfo";
import LegalPage from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";
import { AUTO_COMPLETE_DAYS, DELIVERED_COMPLETE_DAYS, DELIVERY, RESERVATION_DAYS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Handelsbetingelser for købere",
  description:
    "Handelsbetingelser for køb på Relived: hvem du køber af, priser, fragt, betaling, køberbeskyttelse, fortrydelsesret og klager.",
  alternates: { canonical: "/handelsbetingelser" },
};

export default function Handelsbetingelser() {
  return (
    <LegalPage title="Handelsbetingelser for købere" crumb="Handelsbetingelser" updated="oktober 2026">
      <p className="lede">
        Her står, hvad der gælder, når du køber på Relived. Sælgerne har deres egne <Link href="/vilkaar">vilkår</Link>.
      </p>

      <h2>1. Hvem køber du af?</h2>
      <p>
        Relived er en markedsplads. Du køber tingen af sælgeren og ikke af Relived. Ved hver ting og hvert show står der, hvem
        sælgeren er, og om sælgeren er en privatperson eller en virksomhed. Relived står for betalingen, køberbeskyttelsen og
        fragtlabels til pakkeshops.
      </p>
      <CompanyInfo />

      <h2>2. Hvornår er købet bindende?</h2>
      <ul>
        <li><b>Køb i et live-show:</b> Den første, der trykker Køb, mens tingen bliver vist live, har købt tingen.</li>
        <li><b>Budsalg:</b> Det højeste bud, når nedtællingen står på 0, har købt tingen til sit bud. Et bud kan ikke trækkes tilbage.</li>
        <li><b>Køb nu:</b> Trykker du Køb nu på en ting, der er til salg efter et show, har du købt den.</li>
      </ul>
      <p>
        Tingen lander under Mine køb, og du skal betale inden {RESERVATION_DAYS} dage. Betaler du ikke, bliver købet annulleret, og
        sælgeren kan sælge tingen igen.
      </p>

      <h2>3. Priser og gebyrer</h2>
      <ul>
        <li><b>Tingen:</b> den pris, der står ved tingen, eller dit vindende bud.</li>
        <li><b>Fragt:</b> {DELIVERY.ship.price} kr pr. sælger til en DAO- eller GLS-pakkeshop, op til 5 kg. Alt, du køber hos samme sælger, kommer i én pakke. Afhentning hos sælgeren er gratis.</li>
        <li><b>Køberbeskyttelse:</b> 5 % af tingenes pris plus 5 kr pr. pakke. Den betaler for, at pengene bliver holdt tilbage, til du har fået dine ting.</li>
      </ul>
      <p>Alle priser er i danske kroner og med moms, hvor der skal betales moms. Du ser den samlede pris, før du betaler.</p>

      <h2>4. Betaling</h2>
      <p>
        Du betaler under Mine køb med kort, MobilePay, Apple Pay eller Google Pay. Betalingen sker gennem Stripe, og Relived ser
        aldrig dine kortoplysninger. Pengene bliver holdt tilbage og først sendt til sælgeren, når du bekræfter, at du har fået
        tingene. Bekræfter du ikke selv, sker det automatisk {DELIVERED_COMPLETE_DAYS} dage efter, at du har hentet pakken, eller senest{" "}
        {AUTO_COMPLETE_DAYS} dage efter, at den er sendt, medmindre du har meldt et problem.
      </p>

      <h2>5. Levering</h2>
      <p>
        Vælger du pakkeshop, sender sælgeren pakken med DAO eller GLS til den pakkeshop, du har valgt. Du kan følge pakken under Mine
        køb, og fragtfirmaet giver dig besked, når den er klar. Vælger du afhentning, aftaler du tid og sted med sælgeren, som får
        dit telefonnummer.
      </p>

      <h2>6. Køberbeskyttelse: når noget går galt</h2>
      <p>
        Kommer pakken ikke frem, eller er tingen væsentligt anderledes end vist og beskrevet, så tryk <b>Meld et problem</b> på ordren
        under Mine køb, før ordren er afsluttet. Så holder vi pengene tilbage, sælgeren får besked, og vi hjælper jer med at finde en
        løsning. Kan I ikke blive enige, afgør vi sagen og kan give dig pengene tilbage.
      </p>
      <p>
        Køberbeskyttelsen dækker ikke, at du har fortrudt et køb fra en privatperson, eller slid og fejl, som sælgeren viste eller
        fortalte om i showet.
      </p>

      <h2 id="fortrydelsesret">7. Fortrydelsesret</h2>
      <ul>
        <li>
          <b>Køb fra en privat sælger:</b> Der er ikke fortrydelsesret. Forbrugeraftalelovens regler om fortrydelse gælder kun, når du
          køber af en virksomhed.
        </li>
        <li>
          <b>Køb fra en erhvervssælger</b> (står som Erhverv ved sælgeren): Du har 14 dages fortrydelsesret fra den dag, du har fået
          tingen. Giv besked inden fristen med Meld et problem på ordren. Er ordren allerede afsluttet, så skriv til {COMPANY.email},
          så sender vi det videre til sælgeren. Du betaler selv for at sende tingen retur, medmindre sælgeren har oplyst andet.
          Sælgeren betaler prisen og fragten tilbage, når tingen er kommet retur.
        </li>
      </ul>

      <h2>8. Reklamation</h2>
      <p>
        Køber du af en erhvervssælger, har du reklamationsret efter købeloven i 2 år for fejl, der var der, da du fik tingen. Brugte
        ting kan have almindeligt slid, og det er ikke en fejl. Køber du af en privatperson, gælder købelovens almindelige regler.
        Meld en fejl så hurtigt som muligt med Meld et problem eller på {COMPANY.email}.
      </p>

      <h2>9. Opførsel i shows og chat</h2>
      <p>
        Skriv pænt i chatten. Sælgeren kan fjerne beskeder og blokere brugere i sine shows. Ser du en ting, et show eller en profil,
        der ikke er i orden, så tryk <b>Anmeld</b>. Læs mere i <Link href="/vilkaar">vilkårene</Link>.
      </p>

      <h2>10. Klager</h2>
      <p>
        Skriv til {COMPANY.email}, hvis du er utilfreds. Har du købt af en erhvervssælger og kan I ikke blive enige, kan du klage til
        Nævnenes Hus (naevneneshus.dk).
      </p>

      <h2>11. Ansvar</h2>
      <p>
        Sælgeren er ansvarlig for tingen og for at beskrive den rigtigt. Relived er ansvarlig for betalingen, køberbeskyttelsen og
        de andre dele af tjenesten, som vi selv står for.
      </p>

      <h2>12. Ændringer og lovvalg</h2>
      <p>
        Vi kan ændre betingelserne. Ændringer gælder kun for køb efter ændringen. Dansk ret gælder.
      </p>
    </LegalPage>
  );
}
