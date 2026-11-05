// "Skriv med Claude" i Backoffice → Nyhedsbrev: Claude skriver et udkast til nyhedsbrevet ud fra admins stikord, ugens
// program og kampagnerne. Det er kun et udkast: admin læser det, retter og sender en test først. Ingen imports, så den
// kan testes.

export type DraftLength = "kort" | "mellem" | "lang";
export const DRAFT_LENGTHS: Record<DraftLength, { label: string; words: number }> = {
  kort: { label: "Kort", words: 90 },
  mellem: { label: "Mellem", words: 160 },
  lang: { label: "Lang", words: 260 },
};
export const isDraftLength = (v: unknown): v is DraftLength => typeof v === "string" && v in DRAFT_LENGTHS;

export interface NewsletterDraft {
  subject: string;
  text: string;
}

export interface NewsletterContext {
  /** Fx "torsdag 5. november 2026". */
  today: string;
  site: string;
  /** Kampagnerne, der er slået til og ikke overstået, som korte linjer. */
  campaigns: string[];
  /** De næste shows i programmet (kun offentlige). */
  shows: { when: string; title: string; seller: string; url: string }[];
}

const quote = (s: string) => s.replace(/\s+/g, " ").trim().replace(/"/g, "'");

export function newsletterPrompt(brief: string, length: DraftLength, ctx: NewsletterContext, current?: NewsletterDraft | null) {
  const words = DRAFT_LENGTHS[length].words;
  const facts = [
    `- I dag er det ${ctx.today}.`,
    ...(ctx.campaigns.length ? ctx.campaigns.map((c) => `- ${c}`) : ["- Der er ingen kampagner lige nu."]),
    ...(ctx.shows.length
      ? ["- De næste shows i programmet:", ...ctx.shows.map((s) => `  - ${s.when}: "${quote(s.title)}" med ${s.seller}: ${s.url}`)]
      : ["- Der er ingen shows i programmet lige nu."]),
    `- Forsiden: ${ctx.site}`,
    `- Programmet: ${ctx.site}/live`,
    `- Sådan sælger man live: ${ctx.site}/saelg`,
  ];
  const task = current
    ? [
        "Her er det nuværende udkast. Ret det efter opgaven, og lad resten stå, som det er.",
        `Emne: ${current.subject}`,
        "Tekst:",
        current.text,
        "",
        `Opgaven fra Relived: "${quote(brief)}"`,
      ]
    : [`Opgaven fra Relived: "${quote(brief)}"`];
  return [
    "Du skriver nyhedsbreve for Relived, en dansk markedsplads, hvor sælgere sælger brugte og nye varer live på video. Køberne ser varen live, spørger sælgeren i chatten og køber med ét tryk eller byder i budsalg. Sælgeren får først pengene, når køberen har varen.",
    "",
    ...task,
    "",
    "Fakta, du må bruge. Brug kun dem og det, der står i opgaven:",
    ...facts,
    "",
    "Regler:",
    `- Dansk, varm, direkte og lidt fræk tone, som en ven på loppemarkedet. Korte afsnit på 1-3 sætninger. Hele teksten højst ${words} ord.`,
    "- Almindelig tekst til en mail: ingen markdown, ingen stjerner, ingen #-overskrifter og ingen emojis. Punkter med \"- \" er i orden.",
    "- Links skrives som hele adresser på deres egen linje. Brug kun adresserne fra fakta.",
    '- Skriv "vare" og "varer", aldrig "ting".',
    "- Nævn aldrig andre markedspladser, apps eller sociale medier ved navn.",
    "- Find aldrig på priser, rabatter, datoer, klokkeslæt, sælgere, antal eller løfter, der ikke står i opgaven eller i fakta.",
    '- Begynd med "Hej" og slut med "Hilsen Relived". Skriv intet om afmelding, det kommer med automatisk.',
    "- Emnet er højst 60 tegn, konkret og gør nysgerrig.",
    "",
    'Svar kun med JSON i denne form: {"subject": "...", "text": "..."}',
  ].join("\n");
}

/** Læser Claudes svar. Giver udkastet eller null, hvis svaret ikke kunne læses. */
export function parseNewsletterDraft(answer: string): NewsletterDraft | null {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof j.subject !== "string" || typeof j.text !== "string") return null;
  const subject = j.subject.replace(/[*#]/g, "").replace(/\s+/g, " ").trim().slice(0, 150);
  const text = j.text
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 5000);
  return subject && text.length >= 10 ? { subject, text } : null;
}
