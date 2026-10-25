// Alle cookies og alt, Relived gemmer i browseren. Siden /cookies viser listen, og "Glem mine valg" sletter browserlagringen.
// Lægger I en ny cookie eller en ny nøgle i browseren ind i koden, så skriv den på listen her.
//
// Alt her er nødvendigt for, at siden virker, eller husker et valg, du selv har truffet. Derfor skal der ikke spørges om lov
// (cookiebekendtgørelsen § 4, stk. 2), men vi fortæller om det. Kommer der statistik eller annoncer (fx en Meta-pixel), skal
// beskeden laves om, så man kan sige ja eller nej først.

export interface StoredThing {
  name: string;
  what: string;
  how_long: string;
  who: string;
}

/** Cookies (sendes med til serveren). */
export const COOKIES: StoredThing[] = [
  {
    name: "sb-…-auth-token",
    what: "Holder dig logget ind. Den kan være delt i flere dele (…-auth-token.0, .1).",
    how_long: "Til du logger ud, højst 400 dage",
    who: "Relived (login via Supabase)",
  },
  {
    name: "snup_mitid",
    what: "Bruges, mens du bekræfter dig med MitID, så vi ved, at svaret kommer fra dig.",
    how_long: "10 minutter",
    who: "Relived",
  },
  {
    name: "snup_support",
    what: "Så du kan fortsætte din samtale med os i supportchatten. Sættes kun, hvis du skriver til os.",
    how_long: "180 dage",
    who: "Relived",
  },
];

/** Gemt i din browser (localStorage). Det bliver på din enhed og sendes ikke til os. */
export const LOCAL: StoredThing[] = [
  { name: "relived-cookie-info", what: "At du har set beskeden om cookies, så den ikke kommer igen.", how_long: "Til du sletter den", who: "Relived" },
  { name: "snuplive:pakkeshop", what: "Den pakkeshop, du valgte sidst, så du ikke skal vælge den igen.", how_long: "Til du sletter den", who: "Relived" },
  { name: "snup-support", what: "At du har en åben samtale med support, så du kan se, når vi har svaret.", how_long: "Til samtalen er slut", who: "Relived" },
  { name: "relived-push-nej", what: "At du har sagt nej tak til besked på telefonen, så vi ikke spørger igen.", how_long: "Til du sletter den", who: "Relived" },
  { name: "relived-kamerafiltre", what: "Sælgere: om Lys op og Slør baggrund er slået til i studiet.", how_long: "Til du sletter den", who: "Relived" },
  { name: "relived-swipe-ok", what: "Sælgere: at du har set tippet om at swipe i studiet.", how_long: "Til du sletter den", who: "Relived" },
  { name: "relived-rundvisning", what: "Sælgere: at du har set (eller sagt nej tak til) rundvisningen i studiet.", how_long: "Til du sletter den", who: "Relived" },
  { name: "relived-rundvisning-gaest", what: "Gæster i et show: det samme for rundvisningen som gæst.", how_long: "Til du sletter den", who: "Relived" },
];

/** Rundvisningen i studiet (vært og gæst). */
export const TOUR_KEYS = { host: "relived-rundvisning", guest: "relived-rundvisning-gaest" } as const;

export const COOKIE_NOTICE_KEY = "relived-cookie-info";

/** Nøglerne, "Glem mine valg" sletter (ikke login og ikke en åben supportsamtale). */
export const FORGETTABLE = [
  "snuplive:pakkeshop",
  "relived-push-nej",
  "relived-kamerafiltre",
  "relived-swipe-ok",
  "relived-rundvisning",
  "relived-rundvisning-gaest",
];
