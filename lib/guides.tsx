import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Guides (/guides): artikler om at købe og sælge brugt, så flere finder Relived på Google.
 * Hver guide har ét primært søgeord, som står i title, description og H1. H2'erne svarer på de spørgsmål, folk stiller.
 * Skriv "vare" om det, der bliver solgt, og nævn aldrig konkurrenter ved navn.
 */

export interface GuideCta {
  text: string;
  href: string;
  label: string;
}

export interface GuideSection {
  id: string;
  h2: string;
  body: ReactNode;
  cta?: GuideCta;
}

export interface Guide {
  slug: string;
  audience: "Sælger" | "Køber" | "Alle";
  /** Søgeordet, guiden skal findes på. */
  keyword: string;
  /** <title>, højst 60 tegn med " | Relived". */
  title: string;
  /** Meta description, højst 155 tegn. */
  description: string;
  h1: string;
  /** Kort navn til brødkrummer og kort. */
  short: string;
  lede: ReactNode;
  /** Teksten på kortet i oversigten. */
  teaser: string;
  image: { src: string; alt: string; width: number; height: number; position?: string };
  published: string;
  updated: string;
  sections: GuideSection[];
  faq: [string, string][];
  related: string[];
  end: { h2: string; text: string; href: string; label: string };
}

const SAELG: GuideCta = { text: "Det er gratis at sælge på Relived i beta-perioden.", href: "/saelg", label: "Bliv sælger" };

export const GUIDES: Guide[] = [
  {
    slug: "saelg-brugt-toej",
    audience: "Sælger",
    keyword: "sælg brugt tøj",
    title: "Sælg brugt tøj: 12 tips, der får det solgt hurtigt | Relived",
    description:
      "Sælg brugt tøj hurtigt og til en god pris: gør tøjet klar, tag mål, skriv ærligt, sæt prisen rigtigt, og vis det frem på video. 12 konkrete tips.",
    h1: "Sælg brugt tøj: 12 tips, der får det solgt hurtigere",
    short: "Sælg brugt tøj",
    lede: (
      <>
        Det meste brugte tøj kan sælges. Om det bliver solgt i denne uge eller hænger i skabet i tre måneder mere, handler sjældent
        om selve tøjet. Det handler om, hvordan du gør det klar, beskriver det og viser det frem. Her er de 12 greb, der gør den
        største forskel.
      </>
    ),
    teaser: "Gør tøjet klar, tag de rigtige mål, og vis det frem, så køberne ikke er i tvivl.",
    image: { src: "/img/cover-dametoej.jpg", alt: "Brugte kjoler og bluser på et stativ", width: 900, height: 1200, position: "50% 40%" },
    published: "2026-10-31",
    updated: "2026-10-31",
    sections: [
      {
        id: "hvad-saelger",
        h2: "Hvilket brugt tøj kan du sælge?",
        body: (
          <>
            <p>
              Det sælger bedst, som folk ellers ville købe nyt og dyrt: overtøj, strik i uld og kashmir, kjoler til fest, jeans fra
              kendte mærker, sko i god stand, mærkevarer og børnetøj, der næsten ikke er brugt. Tøj fra billige kæder kan også
              sælges, men prisen er lav, så det sælger bedst sammen med andet.
            </p>
            <p>
              Spørg dig selv: ville du selv købe det til den pris, hvis du så det i en genbrugsbutik? Er svaret ja, kan det sælges.
              Undertøj, slidte strømper og tøj med store pletter er sjældent besværet værd.
            </p>
          </>
        ),
      },
      {
        id: "goer-klar",
        h2: "Hvordan gør du tøjet klar til salg?",
        body: (
          <>
            <h3>1. Vask, damp og fjern fnug</h3>
            <p>
              Rent og glat tøj ser dyrere ud. Vask det efter vaskemærket, damp eller stryg det, og tag fnug og nopper af med en
              fnugrulle eller en nopperfjerner. Det tager fem minutter og kan løfte prisen mærkbart.
            </p>
            <h3>2. Fjern lugt</h3>
            <p>
              Røg, parfume og kælderlugt er en af de hyppigste grunde til klager. Luft tøjet ud, og vask det, hvis du er i tvivl.
              Kommer det fra et hjem med røg eller dyr, så skriv det.
            </p>
            <h3>3. Lav det små</h3>
            <p>Sy knappen i, og tjek lynlåsen. Små fejl, du kan rette på et par minutter, får tøjet til at virke slidt, hvis du lader dem være.</p>
          </>
        ),
      },
      {
        id: "maal",
        h2: "Hvilke mål skal du tage?",
        body: (
          <>
            <h3>4. Mål tøjet, mens det ligger fladt</h3>
            <p>
              En størrelse M fra ét mærke kan være en S fra et andet. Derfor er mål det, køberne spørger mest om. Læg tøjet fladt, og
              mål i centimeter:
            </p>
            <ul>
              <li><b>Overdele:</b> brystvidde fra armhule til armhule, længden fra skulder til bund og ærmelængden.</li>
              <li><b>Bukser og nederdele:</b> livvidde, hoftevidde og indvendig benlængde.</li>
              <li><b>Kjoler:</b> brystvidde, talje og længde.</li>
              <li><b>Sko:</b> indvendig længde og eventuelt bredde.</li>
            </ul>
          </>
        ),
      },
      {
        id: "beskriv",
        h2: "Hvordan beskriver du brugt tøj?",
        body: (
          <>
            <h3>5. Skriv det, køberne søger efter</h3>
            <p>
              Start navnet med det, varen er, og tilføj mærke, farve og størrelse, fx <i>Uldfrakke, kamel, str. M</i>. Læs
              materialet på vaskemærket: uld, silke, hør og læder sælger bedre end polyester, så skriv det.
            </p>
            <h3>6. Vær ærlig om fejl</h3>
            <p>
              Vis pletter, nopper og slid, og skriv om dem. Køberne er ikke bange for brugt tøj, men de bryder sig ikke om
              overraskelser. Ærlighed giver færre klager og bedre bedømmelser, og det er dem, næste køber kigger på.
            </p>
          </>
        ),
      },
      {
        id: "pris",
        h2: "Hvad skal tøjet koste?",
        body: (
          <>
            <h3>7. Sæt en pris, der føles som et godt køb</h3>
            <p>
              En god tommelfingerregel er en tredjedel af nyprisen for tøj i god stand. Almindelige butiksmærker ligger lavere,
              eftertragtede mærker og vintage højere. Se de præcise tal og det, der trækker prisen op og ned, i vores guide til{" "}
              <Link href="/guides/pris-paa-brugt-toej">pris på brugt tøj</Link>.
            </p>
          </>
        ),
      },
      {
        id: "video",
        h2: "Hvorfor sælger tøj bedre på video?",
        body: (
          <>
            <h3>8. Vis, hvordan tøjet falder</h3>
            <p>
              Et billede viser farven. En video viser, hvordan stoffet falder, hvor tykt det er, og hvordan det ser ud på en krop.
              Det er præcis det, køberen er i tvivl om, når hun kun har et billede.
            </p>
            <h3>9. Lad køberne spørge, mens de ser</h3>
            <p>
              Når du sælger live, kan køberne spørge om mål og stand i chatten, og du kan vise det med det samme. Så forsvinder den
              lange snak frem og tilbage, og de køber, mens de er interesserede. Har du ikke lyst til at være på kamera, kan du filme
              varen uden selv at være med og sætte den til salg med video.
            </p>
          </>
        ),
        cta: { text: "Sælg dit tøj live på video, eller film det og sæt det til salg.", href: "/saelg", label: "Sådan sælger du på Relived" },
      },
      {
        id: "mange",
        h2: "Hvordan sælger du meget på én gang?",
        body: (
          <>
            <h3>10. Saml det i ét show</h3>
            <p>
              Ét og ét tager tid. Læg 10 til 15 varer i køen, og vis dem frem én ad gangen i et live-show på 20 minutter. Køberne
              betaler kun fragt én gang pr. sælger, så mange køber flere varer hos samme sælger. Se hele tjeklisten i{" "}
              <Link href="/guides/saelg-live-foerste-gang">sælg live første gang</Link>.
            </p>
          </>
        ),
      },
      {
        id: "send",
        h2: "Hvordan sender du tøjet?",
        body: (
          <>
            <h3>11. Pak godt, og send hurtigt</h3>
            <p>
              Fold tøjet pænt, læg det i en pose, så det ikke bliver vådt, og derefter i en plastpose eller en kasse. På Relived
              betaler køberen 49 kr i fragt til en pakkeshop, og du afleverer pakken i pakkeshoppen. Jo hurtigere du sender, jo
              gladere er køberen.
            </p>
            <h3>12. Svar hurtigt og venligt</h3>
            <p>
              Hurtige svar sælger. Det gælder spørgsmål i chatten og beskeder efter købet. En god oplevelse giver en god bedømmelse,
              og den hjælper dig med at sælge næste gang.
            </p>
          </>
        ),
        cta: SAELG,
      },
    ],
    faq: [
      [
        "Hvad sælger bedst af brugt tøj?",
        "Overtøj, strik i uld og kashmir, festkjoler, jeans og sko fra kendte mærker, mærkevarer og børnetøj i pæn stand. Tøj, der passer til årstiden, sælger hurtigst.",
      ],
      [
        "Hvornår på året er det bedst at sælge tøj?",
        "Lige før sæsonen: frakker og strik fra september til november, sommertøj fra april til juni. Folk køber det, de skal bruge nu.",
      ],
      [
        "Skal jeg betale skat, når jeg sælger mit brugte tøj?",
        "Som regel ikke, når det er dit eget tøj, som du har købt til dig selv. Det er anderledes, hvis du køber tøj for at sælge det videre. Læs mere i guiden om skat ved salg af brugt tøj.",
      ],
      ["Hvad koster det at sælge på Relived?", "Det er gratis at sælge i beta-perioden. Køberen betaler fragten og en køberbeskyttelse."],
    ],
    related: ["pris-paa-brugt-toej", "saelg-live-foerste-gang", "skat-ved-salg-af-brugt-toej"],
    end: { h2: "Klar til at rydde op i skabet?", text: "Opret en gratis konto, læg dit tøj i køen, og sælg det live eller med video.", href: "/saelg", label: "Bliv sælger" },
  },

  {
    slug: "pris-paa-brugt-toej",
    audience: "Sælger",
    keyword: "pris på brugt tøj",
    title: "Pris på brugt tøj – sådan sætter du prisen | Relived",
    description:
      "Hvad kan du få for dit tøj? Få en tommelfingerregel for pris på brugt tøj, mærkevarer og børnetøj, og se, hvad der får prisen op og ned.",
    h1: "Pris på brugt tøj: sådan sætter du den rigtige pris",
    short: "Pris på brugt tøj",
    lede: (
      <>
        For høj, og ingen køber. For lav, og du giver penge væk. Den rigtige pris på brugt tøj afhænger af mærket, standen og
        efterspørgslen. Her får du en tommelfingerregel, du kan bruge med det samme, og det, der flytter prisen op eller ned.
      </>
    ),
    teaser: "En enkel tommelfingerregel for prisen, og det, der får den til at stige eller falde.",
    image: { src: "/img/cover-herretoej.jpg", alt: "Brugte jakker i læder og ruskind på en bøjlestang", width: 900, height: 1200, position: "50% 45%" },
    published: "2026-10-31",
    updated: "2026-10-31",
    sections: [
      {
        id: "tommelfingerregel",
        h2: "Hvad kan du få for brugt tøj?",
        body: (
          <>
            <p>
              Start ved nyprisen, og tag en procentdel efter mærke og stand. Tallene her er erfaringstal for tøj i god stand. Har du
              en fejl at fortælle om, så gå lidt ned.
            </p>
            <div className="guide-table" role="table" aria-label="Tommelfingerregel for prisen på brugt tøj">
              <div role="row" className="head">
                <span role="columnheader">Type</span>
                <span role="columnheader">Af nyprisen</span>
              </div>
              <div role="row">
                <span role="cell">Billige kæder og fast fashion</span>
                <span role="cell">10–25 %</span>
              </div>
              <div role="row">
                <span role="cell">Almindelige butiksmærker</span>
                <span role="cell">20–35 %</span>
              </div>
              <div role="row">
                <span role="cell">Kvalitetsmærker og skandinavisk design</span>
                <span role="cell">30–50 %</span>
              </div>
              <div role="row">
                <span role="cell">Eftertragtede mærkevarer og vintage</span>
                <span role="cell">50–80 % eller mere</span>
              </div>
              <div role="row">
                <span role="cell">Børnetøj</span>
                <span role="cell">20–40 %</span>
              </div>
            </div>
            <p>
              Tallene er et udgangspunkt. Se, hvad lignende varer er blevet solgt for, og justér efter det.
            </p>
          </>
        ),
      },
      {
        id: "eksempler",
        h2: "Eksempler: hvad kan du få for dit tøj?",
        body: (
          <>
            <p>Sådan ser tommelfingerreglen ud i kroner for tøj i god stand:</p>
            <ul>
              <li><b>Uldfrakke fra et kvalitetsmærke</b>, nypris 1.500 kr: 450–750 kr.</li>
              <li><b>Jeans fra et kendt mærke</b>, nypris 900 kr, lidt slid: 200–300 kr.</li>
              <li><b>Strik fra en almindelig butik</b>, nypris 400 kr: 80–140 kr.</li>
              <li><b>Flyverdragt til børn</b>, nypris 800 kr, brugt én vinter: 200–300 kr.</li>
              <li><b>T-shirt fra en billig kæde</b>, nypris 99 kr: 10–25 kr, og den sælger bedst sammen med andet.</li>
            </ul>
            <p>
              Eftertragtede designertasker og ure er en klasse for sig. Særligt populære modeller med kvittering kan sælges tæt på
              nyprisen eller endda over, mens mindre kendte modeller ligger lavere. Her er det vigtigere end nogensinde at se, hvad
              lignende varer faktisk er blevet solgt for.
            </p>
          </>
        ),
      },
      {
        id: "op",
        h2: "Hvad får prisen op?",
        body: (
          <ul>
            <li><b>Mærket.</b> Kendte og eftertragtede mærker holder prisen langt bedre end ukendte.</li>
            <li><b>Standen.</b> Med prismærke eller aldrig brugt er næsten nyt. Skriv det.</li>
            <li><b>Materialet.</b> Uld, kashmir, silke, hør og læder er mere værd end blandinger med polyester.</li>
            <li><b>Sæsonen.</b> En vinterfrakke er mere værd i oktober end i maj.</li>
            <li><b>Papirer.</b> Kvittering, æske og dustbag løfter prisen på mærkevarer og luksus.</li>
          </ul>
        ),
      },
      {
        id: "ned",
        h2: "Hvad trækker prisen ned?",
        body: (
          <ul>
            <li>Nopper, pletter, huller og falmede farver.</li>
            <li>Lugt af røg, parfume eller dyr.</li>
            <li>Manglende knapper eller en lynlås, der driller.</li>
            <li>Tøj, der har været meget populært og findes i store mængder brugt.</li>
          </ul>
        ),
      },
      {
        id: "sammenlign",
        h2: "Hvordan finder du prisen på netop din vare?",
        body: (
          <>
            <p>
              Søg på mærke og type, og kig efter det, der faktisk er blevet solgt, ikke det, der står til salg. En pris, ingen har
              købt til, siger ikke meget. Sammenlign med samme mærke, samme stand og gerne samme størrelse.
            </p>
            <p>
              Er du i tvivl, så sæt prisen lidt højt og sænk den efter en uge, hvis ingen er interesserede. På Relived retter du
              prisen under Mine shows.
            </p>
          </>
        ),
      },
      {
        id: "budsalg",
        h2: "Fast pris eller budsalg?",
        body: (
          <>
            <p>
              Fast pris passer til det meste. Budsalg passer til varer, som flere vil have: eftertragtede mærker, sjældne fund og
              vintage. Her sætter du en startpris, og køberne byder op i 30 sekunder.
            </p>
            <p>
              Sæt startprisen til det laveste, du er glad for at sælge til. Byder ingen, kan varen købes bagefter til startprisen.
              Når flere byder, stiger prisen i faste trin, og stemningen i showet gør ofte resten.
            </p>
          </>
        ),
        cta: { text: "Prøv budsalg i dit næste live-show.", href: "/saelg", label: "Sådan sælger du live" },
      },
      {
        id: "fragt",
        h2: "Hvad med fragten?",
        body: (
          <p>
            Køberen betaler fragten oven i prisen. På Relived koster det 49 kr til en pakkeshop, én gang pr. sælger, uanset hvor
            mange varer køberen køber hos dig (op til 5 kg). Billige varer sælger derfor bedst, når køberen kan købe flere varer på
            én gang, fx i et live-show.
          </p>
        ),
      },
    ],
    faq: [
      [
        "Hvor meget kan man få for brugt tøj?",
        "Som tommelfingerregel 20–35 % af nyprisen for almindelige butiksmærker og 30–50 % for kvalitetsmærker i god stand. Eftertragtede mærkevarer og vintage kan holde 50–80 % eller mere.",
      ],
      [
        "Hvad er en god pris for brugt børnetøj?",
        "Omkring 20–40 % af nyprisen for børnetøj i pæn stand. Overtøj, flyverdragter og kendte mærker ligger i den høje ende.",
      ],
      ["Kan jeg ændre prisen bagefter?", "Ja. På Relived retter du prisen under Mine shows, så længe varen ikke er solgt."],
      [
        "Hvad gør jeg, hvis ingen køber?",
        "Sæt prisen 10–20 % ned efter en uge, eller vis varen frem i et live-show, hvor køberne kan se den og stille spørgsmål.",
      ],
    ],
    related: ["saelg-brugt-toej", "saelg-live-foerste-gang", "er-designertasken-aegte"],
    end: { h2: "Har du sat prisen?", text: "Læg dine varer i køen på Relived, og sælg dem live eller med video. Det er gratis i beta.", href: "/saelg", label: "Kom i gang" },
  },

  {
    slug: "skat-ved-salg-af-brugt-toej",
    audience: "Sælger",
    keyword: "skat ved salg af brugt tøj",
    title: "Skat ved salg af brugt tøj: det skal du vide | Relived",
    description:
      "Skat ved salg af brugt tøj: sælger du dit eget tøj, skal du som regel ikke betale. Se, hvornår du skal, og hvad platforme indberetter.",
    h1: "Skat ved salg af brugt tøj: skal du betale noget?",
    short: "Skat ved salg af brugt tøj",
    lede: (
      <>
        Mange bliver i tvivl, når de hører, at markedspladser indberetter sælgere til Skattestyrelsen. Det korte svar er, at du som
        regel ikke skal betale skat, når du sælger dit eget brugte tøj. Her er reglerne, og hvornår det er anderledes.
      </>
    ),
    teaser: "Hvornår du skal betale skat, og hvad markedspladser indberetter til Skattestyrelsen.",
    image: { src: "/img/cover-andet.jpg", alt: "Gamle bøger på række på et bord", width: 900, height: 1200, position: "50% 50%" },
    published: "2026-10-31",
    updated: "2026-10-31",
    sections: [
      {
        id: "kort-svar",
        h2: "Skal du betale skat af dit brugte tøj?",
        body: (
          <>
            <p>
              Nej, ikke som udgangspunkt. Sælger du dit eget tøj og dine egne ejendele, som du har købt til dig selv, skal du ikke
              betale skat. Det gælder også, hvis du sælger meget, og også hvis du får mere for en vare, end du gav.
            </p>
            <p>
              Skattestyrelsen skriver, at det afgørende er, om du har købt det, du sælger, <b>med henblik på videresalg</b>. Det er
              altså ikke prisen eller antallet, der afgør det, men hvorfor du købte det.
            </p>
          </>
        ),
      },
      {
        id: "hvornaar",
        h2: "Hvornår skal du betale skat?",
        body: (
          <>
            <p>Du skal betale skat af fortjenesten, når du har købt varer for at sælge dem igen. Fx når du:</p>
            <ul>
              <li>køber tøj på loppemarkeder eller udsalg for at sælge det dyrere,</li>
              <li>køber sneakers eller tasker, når de udkommer, for at sælge dem videre med fortjeneste,</li>
              <li>sælger tøj, du har lavet eller sat i stand for at tjene penge.</li>
            </ul>
            <p>
              Gør du det jævnligt for at tjene penge, kan det være en virksomhed. Så gælder reglerne for virksomheder, og sælger du
              for mere end 50.000 kr inden for 12 måneder, skal du også momsregistreres. På Relived vælger du, om du sælger som
              privatperson eller virksomhed, når du bliver sælger. Læs mere i <Link href="/vilkaar">vilkårene for sælgere</Link>.
            </p>
          </>
        ),
      },
      {
        id: "indberetning",
        h2: "Hvad indberetter markedspladser til Skattestyrelsen?",
        body: (
          <>
            <p>
              Siden 1. januar 2023 skal markedspladser og andre digitale platforme i EU indberette deres sælgere til
              skattemyndighederne (reglerne hedder DAC7). En sælger bliver indberettet, når hun har:
            </p>
            <ul>
              <li><b>30 salg eller flere</b> på et kalenderår, eller</li>
              <li>fået <b>mere end 2.000 euro</b> (ca. 15.000 kr) for sine salg på et kalenderår.</li>
            </ul>
            <p>
              Platformen indberetter navn, adresse, fødselsdato og CPR-nummer, antal salg og beløbet pr. kvartal og kontonummeret,
              hvis det er kendt. Det sker senest 31. januar året efter. Relived følger de samme regler.
            </p>
            <p>
              <b>Bliver du indberettet, betyder det ikke, at du skal betale skat.</b> Det er bare oplysninger, så Skattestyrelsen kan
              se, hvem der sælger hvor meget. Sælger du dit eget brugte tøj, ændrer det intet.
            </p>
          </>
        ),
      },
      {
        id: "goer",
        h2: "Hvad skal du gøre?",
        body: (
          <>
            <ul>
              <li><b>Sælger du dine egne brugte ejendele:</b> du skal ikke gøre noget.</li>
              <li>
                <b>Har du købt for at sælge videre:</b> skriv fortjenesten på årsopgørelsen i TastSelv (rubrik 20), og skriv den
                forventede indtægt for næste år på forskudsopgørelsen (felt 250).
              </li>
              <li><b>Driver du det som virksomhed:</b> skriv det i oplysningsskemaet (rubrik 111) og på forskudsopgørelsen (felt 221).</li>
            </ul>
            <p>
              Gem gerne kvitteringen for dyre varer som mærkevarer og ure. Den viser, hvad du gav, og at du købte til dig selv. I
              TastSelv kan du se de beløb, platformene har indberettet om dig.
            </p>
          </>
        ),
      },
      {
        id: "eksempler",
        h2: "Tre eksempler",
        body: (
          <div className="tips">
            <div>
              <h3>Maja rydder op i skabet</h3>
              <p>
                Maja sælger 40 af sine egne kjoler, jakker og sko for 6.000 kr på et år. Hun har over 30 salg, så platformen
                indberetter hende. Men det er hendes eget tøj, så hun skal ikke betale skat.
              </p>
            </div>
            <div>
              <h3>Jonas sælger sneakers videre</h3>
              <p>
                Jonas køber to par sneakers, når de udkommer, og sælger dem igen med 1.500 kr i fortjeneste. Han har købt dem for at
                sælge dem videre, så han skal betale skat af de 1.500 kr.
              </p>
            </div>
            <div>
              <h3>Lise køber på loppemarkeder</h3>
              <p>
                Lise køber vintagetøj på loppemarkeder hver weekend og sælger det på nettet. Hun gør det jævnligt for at tjene
                penge, så det kan være en virksomhed. Hun skal betale skat af overskuddet.
              </p>
            </div>
          </div>
        ),
        cta: { text: "Har du tøj, du selv har brugt? Sælg det live eller med video.", href: "/saelg", label: "Bliv sælger" },
      },
      {
        id: "kilder",
        h2: "Hvor kan du læse mere?",
        body: (
          <>
            <p>
              Reglerne her bygger på Skattestyrelsens sider om{" "}
              <a href="https://skat.dk/borger/deleoekonomi/salg-bytte-og-udlejning-af-private-ejendele" target="_blank" rel="noopener noreferrer">
                salg, bytte og udlejning af private ejendele
              </a>{" "}
              og{" "}
              <a href="https://skat.dk/erhverv/ekapital/platformsoekonomi/qa-om-dac7" target="_blank" rel="noopener noreferrer">
                indberetning fra digitale platforme (DAC7)
              </a>
              .
            </p>
            <p className="fine">
              Relived er ikke skatterådgiver. Det er Skattestyrelsen, der afgør den enkelte sag. Er du i tvivl om din egen situation,
              så spørg Skattestyrelsen.
            </p>
          </>
        ),
      },
    ],
    faq: [
      [
        "Hvor meget må jeg sælge for uden at betale skat?",
        "Der er ingen beløbsgrænse. Sælger du dine egne brugte ejendele, skal du ikke betale skat, uanset beløbet. Har du købt varerne for at sælge dem videre, skal du betale skat af fortjenesten, uanset beløbet.",
      ],
      [
        "Får Skattestyrelsen besked, når jeg sælger brugt tøj?",
        "Ja, hvis du har 30 salg eller flere, eller får mere end 2.000 euro, på et kalenderår på samme platform. Platformen indberetter dit navn, CPR-nummer, antal salg og beløbet. Det betyder ikke i sig selv, at du skal betale skat.",
      ],
      [
        "Skal jeg betale skat, hvis jeg sælger med fortjeneste?",
        "Ikke hvis det er dine egne ejendele, som du har købt til dig selv. Har du købt dem for at sælge dem igen, skal du betale skat af fortjenesten.",
      ],
      ["Hvor skriver jeg indtægten i TastSelv?", "Privat salg med fortjeneste skrives i rubrik 20 på årsopgørelsen og i felt 250 på forskudsopgørelsen."],
    ],
    related: ["saelg-brugt-toej", "pris-paa-brugt-toej", "saelg-live-foerste-gang"],
    end: { h2: "Ryd op i skabet med god samvittighed", text: "Sælg dit eget brugte tøj live eller med video. Det er gratis i beta.", href: "/saelg", label: "Bliv sælger" },
  },

  {
    slug: "er-designertasken-aegte",
    audience: "Køber",
    keyword: "designertasken ægte",
    title: "Er designertasken ægte? Sådan tjekker du den | Relived",
    description:
      "Er designertasken ægte? Sådan tjekker du syninger, metal, logo, kode og papirer på en brugt taske, og hvorfor du bør købe med ægthedstjek.",
    h1: "Er designertasken ægte? 9 tegn, du skal tjekke, før du køber",
    short: "Er designertasken ægte?",
    lede: (
      <>
        Kopierne bliver bedre og bedre, og en falsk taske kan være svær at kende fra en ægte på et billede. Her er de tegn, du skal
        tjekke, før du køber en brugt designertaske, og den sikreste måde at handle på.
      </>
    ),
    teaser: "Syninger, metal, logo og papirer, og den sikreste måde at købe en brugt designertaske.",
    image: { src: "/img/cover-luksus.jpg", alt: "Guldsmykker på en skål ved siden af et modemagasin", width: 900, height: 1200, position: "50% 55%" },
    published: "2026-10-31",
    updated: "2026-10-31",
    sections: [
      {
        id: "pris",
        h2: "Er prisen for god til at være sand?",
        body: (
          <>
            <h3>1. Prisen</h3>
            <p>
              Ægte designertasker holder prisen godt. Koster en taske langt under, hvad lignende tasker bliver solgt for, er det det
              første faresignal. Det samme gælder, hvis sælgeren har travlt og vil have dig til at betale med det samme eller uden om
              siden.
            </p>
          </>
        ),
      },
      {
        id: "haandvaerk",
        h2: "Hvad skal du kigge efter på selve tasken?",
        body: (
          <>
            <h3>2. Syningerne</h3>
            <p>Ægte tasker har lige syninger med samme længde hele vejen. Skæve sting, løse tråde og lim i kanterne er dårlige tegn.</p>
            <h3>3. Materialet og kanterne</h3>
            <p>
              Ægte læder dufter af læder og føles levende. Kanterne er malet pænt og jævnt. Læder, der lugter af plastik eller kemi,
              og kanter, der skaller, er faresignaler.
            </p>
            <h3>4. Metallet</h3>
            <p>
              Spænder, lynlåse og nitter er tunge og solide. Graveringen er skarp og sidder lige. Let metal, utydelig gravering og
              farve, der skaller af, ses ofte på kopier.
            </p>
            <h3>5. Logo og skrift</h3>
            <p>
              Sammenlign logoet og skriften med billeder fra mærkets egen hjemmeside. Se på bogstavernes form og afstanden mellem
              dem. På mønstrede tasker sidder mønsteret ofte symmetrisk og bliver ikke skåret skævt over ved sømmene.
            </p>
          </>
        ),
      },
      {
        id: "papirer",
        h2: "Hvad med kode, kvittering og dustbag?",
        body: (
          <>
            <h3>6. Kode eller chip</h3>
            <p>
              Mange mærker har en kode inde i tasken. Nyere tasker fra nogle mærker har en chip i stedet, så en manglende kode er
              ikke altid et faresignal. Omvendt er en kode let at kopiere, så den er ikke et bevis i sig selv.
            </p>
            <h3>7. Kvittering og papirer</h3>
            <p>
              En kvittering fra en butik er det bedste papir. Ægthedskort, dustbag og æske er rare at få med, men de kan også
              forfalskes, så de beviser ikke noget alene.
            </p>
          </>
        ),
      },
      {
        id: "spoerg",
        h2: "Hvad skal du spørge sælgeren om?",
        body: (
          <>
            <h3>8. Historien og nærbilleder</h3>
            <p>
              Spørg, hvor og hvornår tasken er købt, og hvorfor den bliver solgt. Bed om at se indersiden, mærkaten, koden, syningerne
              og metallet tæt på. På video kan du se, hvordan læderet bevæger sig, og hvor tungt metallet er. En ærlig sælger har
              ikke noget imod at vise det.
            </p>
          </>
        ),
      },
      {
        id: "aegthedstjek",
        h2: "Hvordan køber du en designertaske sikkert?",
        body: (
          <>
            <h3>9. Køb med ægthedstjek</h3>
            <p>
              Selv eksperter skal have tasken i hånden for at være helt sikre. Derfor skal mærkevarer som Louis Vuitton, Gucci,
              Chanel, Hermès, Prada, Dior og Rolex og alt i kategorien Luksus til 1.000 kr eller mere ægthedstjekkes af Relived,
              før de kan købes. Er tasken godkendt, står der <b>Ægthed tjekket</b> ved den.
            </p>
            <p>
              Du betaler gennem Relived, og sælgeren får først pengene, når du har tasken. Viser den sig at være falsk, trykker du{" "}
              <b>Meld et problem</b> på ordren og vælger, at den er en kopi. Så får du alle pengene tilbage.
            </p>
          </>
        ),
        cta: { text: "Se designertasker, ure og smykker, der er ægthedstjekket.", href: "/kategori/luksus", label: "Se Luksus" },
      },
    ],
    faq: [
      [
        "Kan man se på en video, om en taske er ægte?",
        "En video viser meget mere end billeder: syninger, metal og hvordan læderet bevæger sig. Men et sikkert svar kræver, at en ekspert har haft tasken i hånden. Køb derfor helst en taske, der er ægthedstjekket.",
      ],
      ["Er et ægthedskort et bevis?", "Nej. Ægthedskort, dustbag og æske kan forfalskes. En kvittering fra en butik er bedre, men et ægthedstjek er det sikreste."],
      [
        "Hvad gør jeg, hvis min taske er falsk?",
        "Køb du den på Relived, så tryk Meld et problem på ordren, før du bekræfter, at du har fået den, og vælg, at den er en kopi. Så får du alle pengene tilbage.",
      ],
      ["Er det ulovligt at sælge en kopi?", "Ja. Det er ulovligt at sælge kopier af mærkevarer, og det er forbudt på Relived."],
    ],
    related: ["koeb-brugt-toej-online", "pris-paa-brugt-toej", "hvad-er-live-shopping"],
    end: { h2: "Køb luksus med ro i maven", text: "Mærkevarer bliver ægthedstjekket, og sælgeren får først pengene, når du har varen.", href: "/kategori/luksus", label: "Se Luksus" },
  },

  {
    slug: "hvad-er-live-shopping",
    audience: "Alle",
    keyword: "live shopping",
    title: "Hvad er live shopping? Sådan virker det | Relived",
    description:
      "Live shopping er, når en sælger viser varer frem på video, og du kan spørge i chatten og købe med det samme. Sådan virker det, og sådan handler du trygt.",
    h1: "Hvad er live shopping? Sådan handler du live på video",
    short: "Hvad er live shopping?",
    lede: (
      <>
        Live shopping er en blanding af et loppemarked og en tv-shop, bare på din telefon. En sælger viser varer frem på video, du
        stiller spørgsmål i chatten, og du køber med ét tryk, mens du ser med.
      </>
    ),
    teaser: "Sådan foregår et live-show, og hvorfor det passer så godt til brugt tøj og design.",
    image: { src: "/img/how-live.jpg", alt: "En sælger holder en skjorte op foran ringlyset og telefonen", width: 1500, height: 1000, position: "50% 40%" },
    published: "2026-10-31",
    updated: "2026-10-31",
    sections: [
      {
        id: "kort",
        h2: "Hvad betyder live shopping?",
        body: (
          <>
            <p>
              Ved live shopping sender en sælger direkte video fra sin telefon eller computer. Hun viser varerne frem én ad gangen
              med navn og pris, og seerne kan skrive i chatten og købe med det samme. Det startede i Asien og er blevet en af de
              hurtigst voksende måder at handle på nettet.
            </p>
            <p>
              Forskellen fra en almindelig netbutik er, at du ser varen i bevægelse og kan få svar med det samme. Forskellen fra et
              loppemarked er, at du kan være med fra sofaen.
            </p>
          </>
        ),
      },
      {
        id: "saadan",
        h2: "Hvordan foregår et live-show?",
        body: (
          <ol>
            <li><b>Sælgeren går live.</b> Du får besked, hvis du følger sælgeren eller har trykket Husk mig.</li>
            <li><b>Varen bliver vist.</b> Navn, størrelse og pris står nederst i billedet.</li>
            <li><b>Du spørger.</b> Skriv i chatten, fx om mål, stand eller materiale, og sælgeren viser det.</li>
            <li><b>Du køber.</b> Den første, der trykker Køb, får varen. Ved budsalg byder du i 30 sekunder, og det højeste bud vinder.</li>
            <li><b>Du betaler bagefter.</b> Alt, du køber hos samme sælger, kommer i én pakke.</li>
          </ol>
        ),
        cta: { text: "Se, hvem der sender live lige nu, eller hvem der går live snart.", href: "/live", label: "Se hvem der er live" },
      },
      {
        id: "brugt",
        h2: "Hvorfor passer live shopping til brugt?",
        body: (
          <>
            <p>
              Brugt tøj og design er unikt. Der findes kun én af hver, og standen er forskellig fra vare til vare. Derfor er der
              altid spørgsmål: Hvordan falder kjolen? Er der nopper? Hvor stor er pletten? På video får du svaret med det samme.
            </p>
            <p>
              Sælgeren slipper for at fotografere og skrive en annonce til hver eneste vare og for de mange beskeder bagefter. Hun
              kan sælge en hel bunke på én aften.
            </p>
          </>
        ),
      },
      {
        id: "trygt",
        h2: "Er det trygt at købe live?",
        body: (
          <>
            <p>På Relived er det bygget, så du ikke tager en risiko, fordi det går hurtigt:</p>
            <ul>
              <li>Du betaler gennem Relived, og sælgeren får først pengene, når du har varen.</li>
              <li>Er varen ikke som vist, trykker du Meld et problem, og vi hjælper.</li>
              <li>Du kan se sælgerens bedømmelser, og om sælgeren er privat eller virksomhed.</li>
              <li>Mærkevarer bliver ægthedstjekket, før de kan købes.</li>
            </ul>
            <p>
              Læs mere i <Link href="/guides/koeb-brugt-toej-online">sådan køber du brugt tøj online</Link> og i{" "}
              <Link href="/handelsbetingelser">handelsbetingelserne</Link>.
            </p>
          </>
        ),
      },
      {
        id: "koeber",
        h2: "Hvordan kommer du i gang som køber?",
        body: (
          <p>
            Opret en gratis konto, så kan du skrive i chatten og købe. Tryk <b>Følg</b> hos de sælgere, du kan lide, så får du besked,
            når de går live. Går du glip af et show, kommer det, der ikke blev solgt, til salg til fast pris bagefter, med et klip fra
            showet.
          </p>
        ),
        cta: { text: "Det er gratis at se med og oprette en konto.", href: "/opret", label: "Opret gratis konto" },
      },
      {
        id: "saelger",
        h2: "Hvordan kommer du i gang som sælger?",
        body: (
          <p>
            Du skal bare bruge en telefon og nogle varer. Læg dem i køen med navn og pris, og gå live fra studiet. Læs tjeklisten i{" "}
            <Link href="/guides/saelg-live-foerste-gang">sælg live første gang</Link>.
          </p>
        ),
        cta: SAELG,
      },
    ],
    faq: [
      ["Koster det noget at se med?", "Nej. Det er gratis at se med. For at skrive i chatten og købe skal du have en gratis konto."],
      [
        "Hvad hvis jeg går glip af showet?",
        "Det, der ikke blev solgt, kommer til salg til fast pris bagefter. Under Klip kan du se korte videoer af varerne fra showene.",
      ],
      ["Skal jeg hente en app?", "Nej. Relived virker i browseren på telefonen og computeren."],
      ["Hvad er en lynrunde?", "I en lynrunde har du ti sekunder til at købe varen. Sælgeren starter den, når mange vil have den samme vare."],
    ],
    related: ["koeb-brugt-toej-online", "saelg-live-foerste-gang", "saelg-brugt-toej"],
    end: { h2: "Se live shopping i praksis", text: "Kig ind i et live-show, eller find noget til fast pris.", href: "/live", label: "Se hvem der er live" },
  },

  {
    slug: "koeb-brugt-toej-online",
    audience: "Køber",
    keyword: "køb brugt tøj online",
    title: "Køb brugt tøj online: 8 tjek før du køber | Relived",
    description:
      "Køb brugt tøj online uden at blive skuffet: tjek mål, stand og sælger, se varen på video, og betal, så pengene holdes tilbage, til du har den.",
    h1: "Køb brugt tøj online: 8 tjek, før du trykker køb",
    short: "Køb brugt tøj online",
    lede: (
      <>
        Brugt tøj er billigere, bedre for klimaet og ofte bedre kvalitet end nyt. Men på nettet kan du ikke mærke stoffet eller prøve
        det på. Med de her otte tjek undgår du de fleste skuffelser.
      </>
    ),
    teaser: "Mål, stand, sælger og betaling: det skal du tjekke, før du køber brugt på nettet.",
    image: { src: "/img/cover-boernetoej.jpg", alt: "Brugt børnetøj i strik på et stativ", width: 900, height: 1200, position: "50% 45%" },
    published: "2026-10-31",
    updated: "2026-10-31",
    sections: [
      {
        id: "maal",
        h2: "Passer det? Tjek målene",
        body: (
          <>
            <h3>1. Mål, ikke kun størrelse</h3>
            <p>
              Størrelser er forskellige fra mærke til mærke og har ændret sig over tid. Find et stykke tøj, du selv har, som passer,
              og mål det. Sammenlign med målene på varen, især brystvidde, længde og livvidde. Står de ikke der, så spørg.
            </p>
          </>
        ),
      },
      {
        id: "stand",
        h2: "Hvordan er standen?",
        body: (
          <>
            <h3>2. Spørg ind til fejl</h3>
            <p>Spørg om nopper, pletter, huller og lugt af røg eller dyr. Spørg hellere en gang for meget. En god sælger svarer gerne.</p>
            <h3>3. Se varen på video</h3>
            <p>
              Billeder kan snyde, især med farver. På video kan du se, hvordan stoffet falder og bevæger sig. Bed sælgeren vende
              varen og vise detaljer og fejl tæt på. Det kan du i et <Link href="/guides/hvad-er-live-shopping">live-show</Link>.
            </p>
          </>
        ),
      },
      {
        id: "saelger",
        h2: "Kan du stole på sælgeren?",
        body: (
          <>
            <h3>4. Tjek bedømmelser og profil</h3>
            <p>
              Se, hvad tidligere købere har skrevet, og hvor længe sælgeren har været aktiv. På Relived kan du også se, om sælgeren
              er privat eller virksomhed, og om sælgeren har bekræftet sig med MitID.
            </p>
            <p>
              Det har betydning for dine rettigheder: køber du af en virksomhed, har du 14 dages fortrydelsesret og 2 års
              reklamationsret. Køber du af en privatperson, er der ikke fortrydelsesret.
            </p>
          </>
        ),
      },
      {
        id: "betaling",
        h2: "Hvordan betaler du sikkert?",
        body: (
          <>
            <h3>5. Betal aldrig uden om</h3>
            <p>
              Overfør aldrig penge direkte til en fremmed, og klik ikke på betalingslinks, du får tilsendt i en besked. Betal gennem
              siden, så pengene holdes tilbage, til du har varen. Vil sælgeren flytte handlen et andet sted hen, så lad være.
            </p>
            <h3>6. Kend den samlede pris</h3>
            <p>
              Læg fragt og gebyrer til prisen. På Relived koster fragten 49 kr til en pakkeshop, én gang pr. sælger, og
              køberbeskyttelsen er 5 % + 5 kr pr. pakke. Køber du flere varer hos samme sælger, betaler du kun fragt én gang.
            </p>
          </>
        ),
        cta: { text: "Se brugt tøj og design, du kan købe nu til fast pris.", href: "/til-salg", label: "Se varer til salg" },
      },
      {
        id: "modtag",
        h2: "Hvad gør du, når pakken kommer?",
        body: (
          <>
            <h3>7. Tjek varen, før du bekræfter</h3>
            <p>
              Pak varen ud med det samme, og sammenlign med beskrivelsen. Er den ikke som vist, så tryk <b>Meld et problem</b> på
              ordren, før du bekræfter, at du har fået den. Så holder vi pengene tilbage og hjælper jer. Bekræfter du ikke selv, sker
              det automatisk to dage efter, at du har hentet pakken.
            </p>
          </>
        ),
      },
      {
        id: "maerkevarer",
        h2: "Hvad med mærkevarer?",
        body: (
          <>
            <h3>8. Køb mærkevarer med ægthedstjek</h3>
            <p>
              Jo dyrere mærke, jo flere kopier. Køb helst mærkevarer, der er ægthedstjekket. Læs, hvad du selv kan tjekke, i guiden{" "}
              <Link href="/guides/er-designertasken-aegte">er designertasken ægte?</Link>
            </p>
          </>
        ),
      },
    ],
    faq: [
      [
        "Er det sikkert at købe brugt tøj online?",
        "Ja, når du betaler gennem siden, så pengene holdes tilbage, til du har varen. Betal aldrig direkte til en fremmed, og tjek sælgerens bedømmelser.",
      ],
      [
        "Kan jeg fortryde et køb af brugt tøj?",
        "Køber du af en virksomhed, har du 14 dages fortrydelsesret. Køber du af en privatperson, er der ikke fortrydelsesret, men du kan stadig melde et problem, hvis varen ikke er som vist.",
      ],
      [
        "Hvad gør jeg, hvis varen ikke er som beskrevet?",
        "Tryk Meld et problem på ordren, før du bekræfter, at du har fået den. Så holder vi pengene tilbage, sælgeren får besked, og vi hjælper jer med en løsning.",
      ],
      ["Hvad koster fragten?", "På Relived koster fragten 49 kr til en pakkeshop, én gang pr. sælger, uanset hvor mange varer du køber hos sælgeren (op til 5 kg)."],
    ],
    related: ["er-designertasken-aegte", "hvad-er-live-shopping", "pris-paa-brugt-toej"],
    end: { h2: "Find dit næste fund", text: "Se brugt tøj og design på video, og køb med pengene holdt tilbage, til du har varen.", href: "/til-salg", label: "Se varer til salg" },
  },

  {
    slug: "saelg-live-foerste-gang",
    audience: "Sælger",
    keyword: "sælg live",
    title: "Sælg live: tjekliste til dit første show | Relived",
    description:
      "Sælg live for første gang med vores tjekliste: varer, lys, lyd, rækkefølge, og hvad du siger, så dit første live-show bliver en succes.",
    h1: "Sælg live første gang: tjekliste til dit første show",
    short: "Sælg live første gang",
    lede: (
      <>
        Dit første live-show behøver ikke være perfekt. De bedste shows minder om en snak ved et bord på loppemarkedet. Med den her
        tjekliste er du klar på en halv time, og du ved, hvad du skal sige, når kameraet er tændt.
      </>
    ),
    teaser: "Varer, lys, lyd og hvad du siger: alt, du skal have styr på før dit første live-show.",
    image: { src: "/img/sell-phone.jpg", alt: "Telefon på stativ med ringlys filmer en sælger, der viser en kjole", width: 2000, height: 1333, position: "50% 40%" },
    published: "2026-10-31",
    updated: "2026-10-31",
    sections: [
      {
        id: "varer",
        h2: "Hvor mange varer skal du have med?",
        body: (
          <>
            <p>
              Start med 10 til 15 varer og et show på cirka 20 minutter. Det er nok til, at der sker noget, og overskueligt, når du
              er ny. Bland gerne størrelser og priser, så flere seere kan finde noget.
            </p>
            <p>
              Tænk over rækkefølgen. Start med noget, der fanger, så seerne bliver hængende, og gem et par af de bedste varer til
              midt i og til sidst.
            </p>
          </>
        ),
      },
      {
        id: "koe",
        h2: "Hvad skal du gøre, før du går live?",
        body: (
          <ul>
            <li><b>Læg varerne i køen.</b> Navn, størrelse og pris er nok. Med billeder og beskrivelse kan køberne finde dem og trykke Husk mig før showet.</li>
            <li><b>Gør tøjet klar.</b> Vask, damp og tag mål. Se alle tipsene i <Link href="/guides/saelg-brugt-toej">sælg brugt tøj</Link>.</li>
            <li><b>Sæt prisen.</b> Se tommelfingerreglen i <Link href="/guides/pris-paa-brugt-toej">pris på brugt tøj</Link>.</li>
            <li><b>Send mærkevarer til ægthedstjek</b> i god tid, så de kan købes i showet.</li>
            <li><b>Opret showet en dag før</b> med et tidspunkt, og del linket. Dem, der følger dig, får besked.</li>
          </ul>
        ),
      },
      {
        id: "teknik",
        h2: "Hvordan får du godt lys og god lyd?",
        body: (
          <ul>
            <li><b>Lys forfra.</b> Stil dig med ansigtet mod et vindue, eller brug et ringlys. Undgå et vindue bag dig.</li>
            <li><b>Telefonen på et stativ.</b> Så har du begge hænder fri til at vise varerne.</li>
            <li><b>Stille rum.</b> Sluk musik og fjernsyn, og tal tæt på telefonen.</li>
            <li><b>God forbindelse og strøm.</b> Brug wifi, og sæt telefonen til opladning.</li>
            <li><b>Test først.</b> Tænd kameraet i studiet, og tjek billede og lyd, før du går live.</li>
          </ul>
        ),
      },
      {
        id: "vis",
        h2: "Hvad siger du, når du viser en vare?",
        body: (
          <>
            <p>Brug 1 til 2 minutter pr. vare, og sig det samme hver gang:</p>
            <ol>
              <li>Hvad det er, mærket og størrelsen.</li>
              <li>Målene, især brystvidde og længde.</li>
              <li>Materialet og standen, også de små fejl.</li>
              <li>Prisen, og at man køber med ét tryk.</li>
            </ol>
            <p>
              Vis varen forfra, bagfra og tæt på mærket og eventuelle fejl. Hold den tæt på kameraet: vi tager selv det bedste billede
              og et kort klip af varen, mens du viser den. Svar på spørgsmål med seerens navn, så føler de sig set.
            </p>
          </>
        ),
      },
      {
        id: "lynrunde",
        h2: "Hvornår skal du bruge lynrunde og budsalg?",
        body: (
          <>
            <p>
              Vil flere have den samme vare, så start en <b>lynrunde</b>: seerne har 10 sekunder til at købe den. Har du en vare,
              som mange vil have, så sæt den til <b>budsalg</b>: seerne byder i 30 sekunder, og det højeste bud vinder.
            </p>
            <p>Seerne kan sende hjerter og effekter, mens du er live. Sig tak, når det sker. Det giver god stemning.</p>
          </>
        ),
      },
      {
        id: "efter",
        h2: "Hvad sker der efter showet?",
        body: (
          <ul>
            <li>Det, du ikke fik solgt, kommer til salg til fast pris med et klip fra showet. Du kan rette prisen under Mine shows.</li>
            <li>Køberne betaler inden 3 dage. Pak varerne, og send dem hurtigt.</li>
            <li>Under Til salg kan du lave en kort video af en vare til dine sociale medier og dele linket.</li>
            <li>Opret næste show med det samme, mens dine seere husker dig.</li>
          </ul>
        ),
        cta: SAELG,
      },
    ],
    faq: [
      ["Hvor længe skal et live-show vare?", "Til det første show er 20 til 30 minutter og 10 til 15 varer et godt sted at starte."],
      [
        "Hvad hvis ingen ser med?",
        "Det sker for alle i starten. Del linket til showet på forhånd, og husk, at det, du ikke sælger, kommer til salg til fast pris bagefter med et klip fra showet.",
      ],
      [
        "Hvornår er det bedst at gå live?",
        "Mange har tid om aftenen på hverdage og søndag eftermiddag og aften. Prøv dig frem, og hold fast i et tidspunkt, så dine følgere ved, hvornår du er live.",
      ],
      ["Kan jeg gå live fra computeren?", "Ja. Du kan gå live fra telefonen eller computeren direkte i browseren. Du skal ikke hente en app."],
      ["Kan vi være flere, der sælger sammen?", "Ja. Tryk Inviter en sælger i studiet. Op til 2 andre sælgere kan være med i dit show."],
    ],
    related: ["saelg-brugt-toej", "pris-paa-brugt-toej", "hvad-er-live-shopping"],
    end: { h2: "Klar til dit første show?", text: "Opret en gratis konto, læg 10 varer i køen, og gå live, når det passer dig.", href: "/saelg", label: "Bliv sælger" },
  },
];

export function guideBySlug(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}

export const guideHref = (g: { slug: string }) => `/guides/${g.slug}`;

/** "31. oktober 2026" */
export function guideDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });
}
