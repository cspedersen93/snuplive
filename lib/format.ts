/**
 * Kategorierne: de største inden for brugt, der passer til live, plus Luksus, Skønhed og "Andet".
 * slug bruges i adressen (/kategori/<slug>), cover er reservebilledet til shows uden profilbillede.
 */
export const CATEGORIES = [
  {
    key: "dametoej",
    /** Ordet i en sætning, fx "brugt dametøj". */
    word: "dametøj",
    slug: "dametoej",
    label: "Dametøj, sko og tasker",
    short: "Dametøj",
    cover: "/img/cover-dametoej.jpg",
    /** Billedet på kategorikortene. */
    card: "/img/kat-dametoej.jpg",
    blurb: "Kjoler, jakker, sneakers og tasker fra danske skabe, vist frem på video.",
    h1: "Brugt dametøj, sko og tasker – køb det live",
    title: "Brugt dametøj, sko og tasker – køb det live | Relived",
    description: "Køb brugt dametøj, sko og tasker live. Se kjolen, jakken eller tasken på video, spørg om mål og stand, og køb den med ét tryk.",
  },
  {
    key: "herretoej",
    /** Ordet i en sætning, fx "brugt herretøj". */
    word: "herretøj",
    slug: "herretoej",
    label: "Herretøj og sneakers",
    short: "Herretøj",
    cover: "/img/cover-herretoej.jpg",
    /** Billedet på kategorikortene. */
    card: "/img/kat-herretoej.jpg",
    blurb: "Jakker, denim, strik og sneakers, hvor du kan se slid og mærker tæt på.",
    h1: "Brugt herretøj og sneakers – køb det live",
    title: "Brugt herretøj og sneakers – køb det live | Relived",
    description: "Køb brugt herretøj og sneakers live. Se jakken, jeansene eller skoene tæt på, spørg om størrelse og slid, og køb dem med ét tryk.",
  },
  {
    key: "luksus",
    /** Ordet i en sætning, fx "brugte designervarer". */
    word: "designervarer",
    slug: "luksus",
    label: "Luksus: tasker, ure og smykker",
    short: "Luksus",
    cover: "/img/cover-luksus.jpg",
    /** Billedet på kategorikortene. */
    card: "/img/kat-luksus.jpg",
    blurb: "Designertasker, ure og smykker. Mærkevarer bliver ægthedstjekket, før de kan købes.",
    h1: "Brugte designertasker, ure og smykker – ægthedstjekket",
    title: "Brugte designertasker og ure – ægthedstjekket | Relived",
    description: "Køb brugte designertasker, ure og smykker live. Mærkevarer bliver ægthedstjekket af Relived, før de kan købes, og betalingen er beskyttet.",
  },
  {
    key: "skoenhed",
    /** Ordet i en sætning. Skønhed sælges kun ny og uåbnet. */
    word: "skønhed",
    slug: "skoenhed",
    label: "Skønhed (ny og uåbnet)",
    short: "Skønhed",
    cover: "/img/cover-skoenhed.jpg",
    /** Billedet på kategorikortene. */
    card: "/img/kat-skoenhed.jpg",
    blurb: "Parfume, makeup og hudpleje, der aldrig er åbnet. Til en lavere pris end i butikken.",
    h1: "Uåbnet parfume, makeup og hudpleje – køb det live",
    title: "Uåbnet parfume, makeup og hudpleje – køb live | Relived",
    description: "Køb ny og uåbnet parfume, makeup og hudpleje live. Se pakken på video, spørg sælgeren, og køb til en lavere pris end i butikken.",
  },
  {
    key: "boernetoej",
    /** Ordet i en sætning, fx "brugt børnetøj". */
    word: "børnetøj",
    slug: "boernetoej",
    label: "Børnetøj og legetøj",
    short: "Børnetøj",
    cover: "/img/cover-boernetoej.jpg",
    /** Billedet på kategorikortene. */
    card: "/img/kat-boernetoej.jpg",
    blurb: "Hele poser i den rigtige størrelse og legetøj, der har mere leg i sig.",
    h1: "Brugt børnetøj og legetøj – køb det live",
    title: "Brugt børnetøj og legetøj – køb det live | Relived",
    description: "Køb brugt børnetøj og legetøj live. Se hele poser i den rigtige størrelse på video, spørg om stand, og få det hele i én pakke.",
  },
  {
    key: "cykler",
    /** Ordet i en sætning, fx "brugte cykler". Ladcykler, løbehjul og barnevogne hører også til her. */
    word: "cykler",
    slug: "cykler-og-barnevogne",
    label: "Cykler og barnevogne",
    short: "Cykler",
    cover: "/img/cover-cykler.jpg",
    /** Billedet på kategorikortene. */
    card: "/img/kat-cykler.jpg",
    blurb: "Børnecykler, ladcykler, elcykler, løbehjul og barnevogne. Mange kan hentes hos sælgeren.",
    h1: "Brugte cykler og barnevogne – køb dem live",
    title: "Brugte cykler, ladcykler og barnevogne – køb live | Relived",
    description: "Køb brugte cykler, ladcykler, elcykler og barnevogne live. Se gear, bremser og slid på video, tjek stelnummeret, og hent den hos sælgeren.",
  },
  {
    key: "bolig",
    /** Ordet i en sætning, fx "brugt design". */
    word: "design",
    slug: "bolig-og-design",
    label: "Bolig og design",
    short: "Bolig",
    cover: "/img/cover-bolig.jpg",
    /** Billedet på kategorikortene. */
    card: "/img/kat-bolig.jpg",
    blurb: "Lamper, keramik og vintage, som du kan se fra alle vinkler, før du køber.",
    h1: "Brugt design til hjemmet – lamper, keramik og vintage live",
    title: "Brugt design, lamper og keramik – køb det live | Relived",
    description: "Køb brugt design live: lamper, keramik, glas og vintage. Se varen fra alle vinkler på video, spørg om mærke og stand, og køb den.",
  },
  {
    key: "samlerting",
    /** Ordet i en sætning, fx "brugte samleobjekter". Nøglen i databasen er stadig "samlerting". */
    word: "samleobjekter",
    slug: "samleobjekter",
    label: "Samleobjekter",
    short: "Samleobjekter",
    cover: "/img/cover-samleobjekter.jpg",
    /** Billedet på kategorikortene. */
    card: "/img/kat-samleobjekter.jpg",
    blurb: "Vinyl, LEGO, samlerkort og retrospil til samlere, der vil se standen live.",
    h1: "Brugt vinyl, LEGO og samlerkort – køb samleobjekter live",
    title: "Brugt vinyl, LEGO og samlerkort – køb det live | Relived",
    description: "Køb brugt vinyl, LEGO, samlerkort og retrospil live. Se standen tæt på video, spørg sælgeren, og køb det, før en anden gør.",
  },
  {
    key: "andet",
    /** Ordet i en sætning, fx "brugt vare". */
    word: "vare",
    slug: "andet",
    label: "Andet",
    short: "Andet",
    cover: "/img/cover-andet.jpg",
    /** Billedet på kategorikortene. */
    card: "/img/kat-andet.jpg",
    blurb: "Bøger, sport, værktøj og alt det, der ikke passer i de andre kategorier.",
    h1: "Andre brugte varer – køb dem live",
    title: "Andre brugte varer – køb dem live | Relived",
    description: "Køb brugte varer live: bøger, sport, værktøj og alt det, der ikke passer i de andre kategorier. Se varen på video, og køb den.",
  },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

/** Kategorierne, der kan vælges i formularerne (uden dem, hvis fil ikke er kørt endnu, se lib/categories.ts). */
export const pickCategories = (hidden: readonly string[] = []) => CATEGORIES.filter((c) => !hidden.includes(c.key));

/** Kategorierne i menuen og i bunden af siden (uden "Andet"). */
export const MAIN_CATEGORIES = CATEGORIES.filter((c) => c.key !== "andet");

/** Kategorier, hvor alt skal være nyt og uåbnet (af hensyn til hygiejne og reglerne for kosmetik). */
export const NEW_ONLY_CATEGORIES: readonly string[] = ["skoenhed"];
/** Standen, som ting i de kategorier altid får. */
export const NEW_ONLY_CONDITION = "Ny og uåbnet";

/**
 * Feltet "size" følger kategorien: tøj og sko har str., tasker, bolig og andet har mål, skønhed har indhold,
 * cykler har størrelse. Samleobjekter har intet felt. Alt gemmes i samme kolonne (items.size).
 */
const SIZE_FIELDS: Record<string, { label: string; placeholder: string } | null> = {
  dametoej: { label: "Str.", placeholder: "M" },
  herretoej: { label: "Str.", placeholder: "L" },
  boernetoej: { label: "Str.", placeholder: "92" },
  luksus: { label: "Mål (valgfri)", placeholder: "30 × 22 cm" },
  skoenhed: { label: "Indhold (valgfri)", placeholder: "50 ml" },
  cykler: { label: "Størrelse (valgfri)", placeholder: "26 tommer" },
  bolig: { label: "Mål (valgfri)", placeholder: "40 × 60 cm" },
  samlerting: null,
  andet: { label: "Mål (valgfri)", placeholder: "30 × 40 cm" },
};

/** Feltet til størrelse, mål eller indhold for en kategori (null: intet felt). Uden kategori: et bredt felt. */
export function sizeField(cat: string | null | undefined) {
  if (cat && cat in SIZE_FIELDS) return SIZE_FIELDS[cat];
  return { label: "Str. eller mål (valgfri)", placeholder: "M eller 40 × 60 cm" };
}

/** Eksemplet i feltet "Hvad er det?", så formularen ikke kun taler om tøj. */
const NAME_EXAMPLES: Record<string, string> = {
  dametoej: "Fx Uldfrakke, kamel",
  herretoej: "Fx Læderjakke, sort",
  boernetoej: "Fx Flyverdragt, blå",
  luksus: "Fx Skuldertaske, læder",
  skoenhed: "Fx Parfume, uåbnet",
  cykler: "Fx Ladcykel med 3 hjul",
  bolig: "Fx Bordlampe, messing",
  samlerting: "Fx LEGO-sæt, komplet",
  andet: "Fx Brætspil, komplet",
};
export const nameExample = (cat: string | null | undefined) => (cat && NAME_EXAMPLES[cat]) || "Fx Uldfrakke, kamel";

// En tøj- eller skostørrelse (M, S/M, 38, 92, 38-40): vises som "Str. M". Mål og indhold (40 × 60 cm, 50 ml) vises, som de er.
const CLOTH_SIZE = /^(?:xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,3})(?:\s*[-–/]\s*(?:xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,3}))?$/i;

/** "Str. M" for tøj og sko, ellers værdien som den er (fx "40 × 60 cm" eller "50 ml"). */
export function sizeText(size: string | null | undefined) {
  const s = (size ?? "").trim();
  if (!s) return null;
  const bare = s.replace(/^str(?:\.|ørrelse)?\s*/i, "");
  return CLOTH_SIZE.test(bare) ? `Str. ${bare}` : s;
}

/** "brugt dametøj", "brugte cykler" (flertal), men "uåbnet skønhed" for skønhed. */
export function usedPhrase(c: { key: string; word: string }) {
  if (NEW_ONLY_CATEGORIES.includes(c.key)) return `uåbnet ${c.word}`;
  return /er$/.test(c.word) ? `brugte ${c.word}` : `brugt ${c.word}`;
}

export function category(key: string | null | undefined) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** Gamle adresser, der sendes videre til den nye (kategorien Samlerting hedder nu Samleobjekter). */
const OLD_SLUGS: Record<string, string> = { samlerting: "samleobjekter" };

export function categoryBySlug(slug: string) {
  const s = OLD_SLUGS[slug] ?? slug;
  return CATEGORIES.find((c) => c.slug === s) ?? null;
}

const nf = new Intl.NumberFormat("da-DK");
/** "vare" eller "varer" efter antallet: "1 vare", "3 varer". */
export function vareOrd(n: number | string | null | undefined) {
  return Number(n) === 1 ? "vare" : "varer";
}

/**
 * Beskederne fra databasen (fx "Tingen er allerede solgt") er skrevet i migrationerne. I stedet for at lave dem
 * om dér, bliver ordet ting til vare, når beskeden vises. Så siger hele siden vare.
 */
export function vareTekst(msg: string) {
  return msg.replace(/(?<!\p{L})([Tt])ing(ene|en)?(?!\p{L})/gu, (_, t: string, end?: string) => {
    const w = end === "ene" ? "varerne" : end === "en" ? "varen" : "varer";
    return t === "T" ? w[0].toUpperCase() + w.slice(1) : w;
  });
}

export function kr(n: number) {
  return `${nf.format(n)} kr`;
}

const GRADS = [
  "linear-gradient(135deg,#F4AC94,#C46E8A)",
  "linear-gradient(135deg,#B9D9C6,#4E8A74)",
  "linear-gradient(135deg,#F2D27A,#B5803A)",
  "linear-gradient(135deg,#9DB4E0,#3D5C9E)",
  "linear-gradient(135deg,#D9A38C,#8C4E3A)",
];
export function gradFor(handle: string) {
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  return GRADS[h % GRADS.length];
}
export function initial(handle: string) {
  return (handle.replace(/[^a-z0-9]/gi, "").charAt(0) || "S").toUpperCase();
}

const TZ = "Europe/Copenhagen";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("da-DK", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("da-DK", { timeZone: TZ, weekday: "long" });
const dateFmt = new Intl.DateTimeFormat("da-DK", { timeZone: TZ, day: "numeric", month: "short" });

/** Klokkeslæt som "20.15" (dansk tid). */
export function clock(iso: string) {
  return timeFmt.format(new Date(iso)).replace(":", ".");
}

/** "I dag", "I morgen", "Tirsdag" eller "24. okt." (dansk tid). */
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const key = dayKey.format(d);
  if (key === dayKey.format(now)) return "I dag";
  if (key === dayKey.format(new Date(now.getTime() + 864e5))) return "I morgen";
  const diff = d.getTime() - now.getTime();
  if (diff > 0 && diff < 6 * 864e5) {
    const w = weekdayFmt.format(d);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return dateFmt.format(d);
}

export function when(iso: string | null) {
  if (!iso) return "Tidspunkt kommer";
  return `${dayLabel(iso)} kl. ${clock(iso)}`;
}

export const HANDLE_RE = /^[a-z0-9._]{3,24}$/;
