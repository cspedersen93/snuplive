import Link from "next/link";
import type { CategoryKey } from "@/lib/format";

// Tekster til kategorisiderne (/kategori/<slug>). Godkendt i dokumentet "SnupLive – tekster til forside, kategorier og varesider".

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
      "Find brugte kjoler, jakker, sko og tasker fra danske skabe. Sælgeren viser tøjet frem på video, så du kan se pasform, stof og slid, før du snupper.",
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
        p: "Bed sælgeren holde hver ting op, så du ved, hvad du får. Spørg også, om alt er i samme størrelse.",
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
        Køber du flere ting hos samme sælger, betaler du kun fragt én gang. Det gælder op til 5 kg. LEGO finder du under{" "}
        <Link href="/kategori/samlerting">Samlerting</Link>.
      </>
    ),
    sellH2: "Har du selv børnetøj, der skal videre?",
  },
  bolig: {
    intro:
      "Find brugte lamper, keramik, glas og vintage til hjemmet. På video kan sælgeren vende tingen, tænde lampen og vise stemplet i bunden.",
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
        p: "Bed sælgeren dreje tingen mod lyset. Små skår i kanten og hårfine revner i glasuren er nemmere at se, når den bevæger sig.",
      },
      { h: "Tænd lampen", p: "Bed sælgeren tænde lampen og vise ledningen og stikket." },
      {
        h: "Store og tunge ting",
        p: "Fragt til pakkeshop gælder op til 5 kg. Møbler og andre tunge ting henter du gratis hos sælgeren.",
      },
    ],
    sellH2: "Har du selv design, der skal videre?",
  },
  samlerting: {
    intro:
      "Find brugte vinylplader, LEGO, samlerkort og retrospil. Samlere vil se standen, før de køber, og på video kan du se den helt tæt på.",
    who: "Hvem sælger vinyl og samlerting live?",
    soon: "Hvilke samlerting bliver vist snart?",
    sale: "Brugt vinyl og samlerting til salg nu",
    saleAll: "Se alle samlerting til salg",
    tipsH2: "Hvad skal du kigge efter, når du køber brugt vinyl og samlerting?",
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
    sellH2: "Har du selv samlerting, der skal videre?",
  },
  andet: {
    intro: "Bøger, sport, værktøj, hobby og meget mere. Se tingen på video, spørg sælgeren, og snup den med ét tryk.",
    who: "Hvem sælger brugte ting live?",
    soon: "Hvad bliver vist snart?",
    sale: "Andre brugte ting til salg nu",
    saleAll: "Se alle andre ting til salg",
    tipsH2: "Hvad skal du kigge efter, når du køber brugte ting?",
    tips: [
      { h: "Se den virke", p: "Bed sælgeren tænde, starte eller prøve tingen, mens du ser med." },
      { h: "Er alt med?", p: "Spørg til opladere, ledninger, låg og andre dele, der let bliver væk." },
      {
        h: "Mål og vægt",
        p: "Fragt til pakkeshop gælder op til 5 kg. Tungere ting henter du gratis hos sælgeren.",
      },
    ],
  },
};
