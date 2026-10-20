/**
 * Kategorierne: de fem største inden for brugt, der passer til live, plus "Andet".
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
    cover: "/img/c-kjoler.jpg",
    blurb: "Kjoler, jakker, sneakers og tasker fra danske skabe, vist frem på video.",
    h1: "Brugt dametøj, sko og tasker – køb det live",
    title: "Brugt dametøj, sko og tasker – køb det live | SnupLive",
    description: "Køb brugt dametøj, sko og tasker live. Se kjolen, jakken eller tasken på video, spørg om mål og stand, og snup den med ét tryk.",
  },
  {
    key: "herretoej",
    /** Ordet i en sætning, fx "brugt herretøj". */
    word: "herretøj",
    slug: "herretoej",
    label: "Herretøj og sneakers",
    short: "Herretøj",
    cover: "/img/c-jakker.jpg",
    blurb: "Jakker, denim, strik og sneakers, hvor du kan se slid og mærker tæt på.",
    h1: "Brugt herretøj og sneakers – køb det live",
    title: "Brugt herretøj og sneakers – køb det live | SnupLive",
    description: "Køb brugt herretøj og sneakers live. Se jakken, jeansene eller skoene tæt på, spørg om størrelse og slid, og snup dem med ét tryk.",
  },
  {
    key: "boernetoej",
    /** Ordet i en sætning, fx "brugt børnetøj". */
    word: "børnetøj",
    slug: "boernetoej",
    label: "Børnetøj og legetøj",
    short: "Børn",
    cover: "/img/live2.jpg",
    blurb: "Hele poser i den rigtige størrelse og legetøj, der har mere leg i sig.",
    h1: "Brugt børnetøj og legetøj – køb det live",
    title: "Brugt børnetøj og legetøj – køb det live | SnupLive",
    description: "Køb brugt børnetøj og legetøj live. Se hele poser i den rigtige størrelse på video, spørg om stand, og få det hele i én pakke.",
  },
  {
    key: "bolig",
    /** Ordet i en sætning, fx "brugt design". */
    word: "design",
    slug: "bolig-og-design",
    label: "Bolig og design",
    short: "Bolig",
    cover: "/img/c-lamper.jpg",
    blurb: "Lamper, keramik og vintage, som du kan se fra alle vinkler, før du køber.",
    h1: "Brugt design til hjemmet – lamper, keramik og vintage live",
    title: "Brugt design, lamper og keramik – køb det live | SnupLive",
    description: "Køb brugt design live: lamper, keramik, glas og vintage. Se tingen fra alle vinkler på video, spørg om mærke og stand, og snup den.",
  },
  {
    key: "samlerting",
    /** Ordet i en sætning, fx "brugt samlerting". */
    word: "samlerting",
    slug: "samlerting",
    label: "Samlerting",
    short: "Samlerting",
    cover: "/img/c-vinyl.jpg",
    blurb: "Vinyl, LEGO, samlerkort og retrospil til samlere, der vil se standen live.",
    h1: "Brugt vinyl, LEGO og samlerkort – køb samlerting live",
    title: "Brugt vinyl, LEGO og samlerkort – køb det live | SnupLive",
    description: "Køb brugt vinyl, LEGO, samlerkort og retrospil live. Se standen tæt på video, spørg sælgeren, og snup det, før en anden gør.",
  },
  {
    key: "andet",
    /** Ordet i en sætning, fx "brugt ting". */
    word: "ting",
    slug: "andet",
    label: "Andet",
    short: "Andet",
    cover: "/img/live3.jpg",
    blurb: "Bøger, sport, værktøj og alt det, der ikke passer i de andre kategorier.",
    h1: "Andre brugte ting – køb dem live",
    title: "Andre brugte ting – køb dem live | SnupLive",
    description: "Køb brugte ting live: bøger, sport, værktøj og alt det, der ikke passer i de andre kategorier. Se tingen på video, og snup den.",
  },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

/** De fem kategorier, der vises i menuen og på forsiden (uden "Andet"). */
export const MAIN_CATEGORIES = CATEGORIES.filter((c) => c.key !== "andet");

export function category(key: string | null | undefined) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function categoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

const nf = new Intl.NumberFormat("da-DK");
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
