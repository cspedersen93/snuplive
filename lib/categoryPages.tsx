import Link from "next/link";
import type { CategoryKey } from "@/lib/format";

// Tekster til kategorisiderne (/kategori/<slug>). Godkendt i dokumentet "Relived – tekster til forside, kategorier og varesider".

export interface CategoryPageCopy {
  /** Teksten under H1. */
  intro: string;
  /** H2 over shows, der er live eller starter snart. */
  who: string;
  /** H2 over ting i kommende shows. */
  soon: string;
  /** H2 over ting til salg. */
  sale: string;
  /** Knappen til hele listen med ting til salg i kategorien. */
  saleAll: string;
  tipsH2: string;
  tips: { h: string; p: string }[];
  /** Ekstra afsnit under rådene (valgfrit). */
  note?: React.ReactNode;
  /** H2 til sælgerne. Ingen på "Andet". */
  sellH2?: string;
}

export const CATEGORY_PAGES: Record<CategoryKey, CategoryPageCopy> = {
  dametoej: {
    intro:
      "Find brugte kjoler, jakker, sko og tasker fra danske skabe. Sælgeren viser tøjet frem på video, så du kan se pasform, stof og slid, før du køber.",
    who: "Hvem sælger brugt dametøj live?",
    soon: "Hvilket dametøj bliver vist snart?",
    sale: "Brugt dametøj til salg nu",
    saleAll: "Se alt dametøj til salg",
    tipsH2: "Hvad skal du kigge efter, når du køber brugt dametøj?",
    tips: [
      {
        h: "Mål frem for størrelse",
        p: "Størrelser varierer fra mærke til mærke. Bed sælgeren måle brystvidde, talje og længde, og sammenlign med noget, du selv har.",
      },
      {
        h: "Stoffet tæt på",
        p: "Bed om at se stoffet helt op til kameraet. Så kan du se fnuller, misfarvning og tynde steder ved armhulerne.",
      },
      {
        h: "Lynlåse, knapper og for",
        p: "Bed sælgeren lyne op og ned og vise foret. Det er de steder, der oftest går i stykker.",
      },
      {
        h: "Sko og tasker indefra",
        p: "Bed om at se sålen, hælene og tasken indvendigt. Slid i hjørnerne og ved hanken ses bedst, når tasken bliver vendt.",
      },
    ],
    sellH2: "Har du selv dametøj, der skal videre?",
  },
  herretoej: {
    intro:
      "Find brugte jakker, jeans, strik og sneakers. På video kan du se slid, mærker og pasform tæt på og spørge om det, billederne ikke viser.",
    who: "Hvem sælger brugt herretøj live?",
    soon: "Hvilket herretøj bliver vist snart?",
    sale: "Brugt herretøj og sneakers til salg nu",
    saleAll: "Se alt herretøj til salg",
    tipsH2: "Hvad skal du kigge efter, når du køber brugt herretøj og sneakers?",
    tips: [
      {
        h: "Mål på jakker og jeans",
        p: "Bed om skulderbredde og ærmelængde på jakker og om livvidde og indvendig benlængde på jeans.",
      },
      { h: "Sålen på sneakers", p: "Bed sælgeren vende skoen. En slidt hæl og sål viser, hvor meget de har gået." },
      {
        h: "Mærket og labels",
        p: "Bed om at se mærket og vaskemærket tæt på. Er det et par dyre sneakers, så spørg, om æsken følger med.",
      },
      { h: "Strik ved albuer og manchetter", p: "Det er her, strik bliver tynd og fnuller først." },
    ],
    sellH2: "Har du selv herretøj, der skal videre?",
  },
  luksus: {
    intro:
      "Find brugte designertasker, ure og smykker. Mærkevarer bliver ægthedstjekket af Relived, før de kan købes, og du ser varen tæt på video, før du beslutter dig.",
    who: "Hvem sælger designertasker og ure live?",
    soon: "Hvilke luksusvarer bliver vist snart?",
    sale: "Brugte designervarer til salg nu",
    saleAll: "Se alle designervarer til salg",
    tipsH2: "Hvordan køber du brugte designervarer trygt?",
    tips: [
      {
        h: "Kig efter mærket Ægthed tjekket",
        p: "Mærkevarer som Louis Vuitton, Gucci, Chanel og Rolex skal tjekkes af Relived, før de kan købes. Sælgeren sender nærbilleder af logo, koder og syninger, og vi godkender dem.",
      },
      {
        h: "Bed om koder og prægninger live",
        p: "Bed sælgeren holde serie- eller datokoden, prægningen og metaldelene helt op til kameraet. Ægte varer har skarpe, lige bogstaver og pæne syninger.",
      },
      {
        h: "Kvittering og ægthedsbevis",
        p: "Spørg, om der følger kvittering, ægthedsbevis, dustbag eller æske med. Det gør varen nemmere at sælge igen.",
      },
      {
        h: "Er den falsk, får du pengene tilbage",
        p: "Sælgeren får først pengene, når du har varen. Viser den sig at være en kopi, melder du det under Mine køb, og så får du alle pengene tilbage.",
      },
    ],
    sellH2: "Har du en designertaske eller et ur, der skal videre?",
  },
  skoenhed: {
    intro:
      "Find ny og uåbnet parfume, makeup og hudpleje til en lavere pris end i butikken. På Relived må skønhedsprodukter kun sælges, hvis de aldrig har været åbnet.",
    who: "Hvem sælger skønhed live?",
    soon: "Hvilke skønhedsprodukter bliver vist snart?",
    sale: "Uåbnet skønhed til salg nu",
    saleAll: "Se alt skønhed til salg",
    tipsH2: "Hvad skal du kigge efter, når du køber skønhed?",
    tips: [
      {
        h: "Forseglingen intakt",
        p: "Bed sælgeren vise folien, forseglingen eller låget tæt på kameraet. Alt skal være nyt og uåbnet.",
      },
      {
        h: "Holdbarhed og batchnummer",
        p: "Spørg om udløbsdato eller batchnummer. Hudpleje og makeup holder ikke for evigt, heller ikke uåbnet.",
      },
      {
        h: "Parfume fra kendte mærker",
        p: "Parfume bliver ofte kopieret. Bed om at se æsken, stregkoden og flaskens bund, og sammenlign med mærkets egne billeder.",
      },
    ],
    note: (
      <p>
        Brugt makeup og hudpleje må ikke sælges på Relived af hensyn til hygiejnen. Ser du noget, der er åbnet, så tryk{" "}
        <b>Anmeld</b> på varen. Læs mere om <Link href="/saadan-virker-det#tryg-handel">tryg handel</Link>.
      </p>
    ),
    sellH2: "Har du skønhedsprodukter, du aldrig fik brugt?",
  },
  boernetoej: {
    intro:
      "Find brugt børnetøj i den rigtige størrelse og legetøj, der stadig har mange timers leg i sig. Mange sælgere viser hele poser, så du kan købe en hel sæson på én gang.",
    who: "Hvem sælger brugt børnetøj live?",
    soon: "Hvilket børnetøj og legetøj bliver vist snart?",
    sale: "Brugt børnetøj og legetøj til salg nu",
    saleAll: "Se alt børnetøj til salg",
    tipsH2: "Hvad skal du kigge efter, når du køber brugt børnetøj?",
    tips: [
      {
        h: "Hvad er der i posen?",
        p: "Bed sælgeren holde hver vare op, så du ved, hvad du får. Spørg også, om alt er i samme størrelse.",
      },
      { h: "Knæ, numse og manchetter", p: "Det er her, børnetøj bliver slidt først. Bed om at se dem tæt på." },
      {
        h: "Legetøj, der er komplet",
        p: "Spørg, om alle dele er med, og bed sælgeren tænde legetøj med batterier.",
      },
      {
        h: "Små dele til de mindste",
        p: "Spørg, hvilken alder legetøjet er til, og bed om at se, om der er små dele, der kan falde af.",
      },
    ],
    note: (
      <>
        Køber du flere varer hos samme sælger, betaler du kun fragt én gang. Det gælder op til 5 kg. LEGO finder du under{" "}
        <Link href="/kategori/samleobjekter">Samleobjekter</Link>.
      </>
    ),
    sellH2: "Har du selv børnetøj, der skal videre?",
  },
  bolig: {
    intro:
      "Find brugte lamper, keramik, glas og vintage til hjemmet. På video kan sælgeren vende varen, tænde lampen og vise stemplet i bunden.",
    who: "Hvem sælger brugt design live?",
    soon: "Hvilket design bliver vist snart?",
    sale: "Brugt design til salg nu",
    saleAll: "Se alt design til salg",
    tipsH2: "Hvad skal du kigge efter, når du køber brugt design?",
    tips: [
      {
        h: "Stempel og signatur",
        p: "Meget keramik og mange designklassikere er mærket i bunden. Bed sælgeren vise mærket tæt på.",
      },
      {
        h: "Skår og revner",
        p: "Bed sælgeren dreje varen mod lyset. Små skår i kanten og hårfine revner i glasuren er nemmere at se, når den bevæger sig.",
      },
      { h: "Tænd lampen", p: "Bed sælgeren tænde lampen og vise ledningen og stikket." },
      {
        h: "Store og tunge varer",
        p: "Fragt til pakkeshop gælder op til 5 kg. Møbler og andre tunge varer henter du gratis hos sælgeren.",
      },
    ],
    sellH2: "Har du selv design, der skal videre?",
  },
  samlerting: {
    intro:
      "Find brugte vinylplader, LEGO, samlerkort og retrospil. Samlere vil se standen, før de køber, og på video kan du se den helt tæt på.",
    who: "Hvem sælger vinyl og samleobjekter live?",
    soon: "Hvilke samleobjekter bliver vist snart?",
    sale: "Brugt vinyl og samleobjekter til salg nu",
    saleAll: "Se alle samleobjekter til salg",
    tipsH2: "Hvad skal du kigge efter, når du køber brugt vinyl og samleobjekter?",
    tips: [
      {
        h: "Pladens stand",
        p: "Mange sælgere bruger graderingen Mint, Near Mint, VG+, VG og Good. Bed om at se pladen i lyset, så ridser bliver tydelige, og spørg til omslaget.",
      },
      {
        h: "Tryk og udgave",
        p: "Spørg, hvilken udgave det er, og bed om at se etiketten midt på pladen tæt på.",
      },
      {
        h: "LEGO, der er komplet",
        p: "Spørg, om alle klodser, figurer og byggevejledningen er med, og om æsken følger med.",
      },
      { h: "Samlerkort", p: "Bed om at se hjørner, kanter og bagside tæt på. Det er der, slid viser sig først." },
    ],
    sellH2: "Har du selv samleobjekter, der skal videre?",
  },
  andet: {
    intro: "Bøger, sport, værktøj, hobby og meget mere. Se varen på video, spørg sælgeren, og køb den med ét tryk.",
    who: "Hvem sælger brugte varer live?",
    soon: "Hvad bliver vist snart?",
    sale: "Andre brugte varer til salg nu",
    saleAll: "Se alle andre varer til salg",
    tipsH2: "Hvad skal du kigge efter, når du køber brugte varer?",
    tips: [
      { h: "Se den virke", p: "Bed sælgeren tænde, starte eller prøve varen, mens du ser med." },
      { h: "Er alt med?", p: "Spørg til opladere, ledninger, låg og andre dele, der let bliver væk." },
      {
        h: "Mål og vægt",
        p: "Fragt til pakkeshop gælder op til 5 kg. Tungere varer henter du gratis hos sælgeren.",
      },
    ],
  },
};
