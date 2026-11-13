// "Meld et problem": grunde, køberen kan vælge. Bruges både i browseren og på serveren.

export const ISSUE_REASONS = {
  not_received: "Jeg har ikke fået pakken",
  not_as_shown: "Varen er ikke som vist eller beskrevet",
  damaged: "Varen er gået i stykker undervejs",
  counterfeit: "Varen er falsk (en kopi)",
  withdrawal: "Jeg vil fortryde købet (kun ved køb fra en virksomhed)",
  other: "Noget andet",
} as const;

export type IssueReason = keyof typeof ISSUE_REASONS;

export const isIssueReason = (v: unknown): v is IssueReason => typeof v === "string" && v in ISSUE_REASONS;

/** Sådan blev sagen afgjort, set fra køberens side. */
export const BUYER_RESOLUTION_TEXT: Record<string, string> = {
  refunded: "Du har fået pengene tilbage.",
  released: "Pengene er sendt til sælgeren.",
  closed: "Sagen er lukket.",
  buyer_confirmed: "Du har bekræftet, at alt er i orden.",
};

export const RESOLUTION_TEXT: Record<string, string> = {
  refunded: "Køberen har fået pengene tilbage.",
  released: "Pengene er sendt til sælgeren.",
  closed: "Sagen er lukket.",
  buyer_confirmed: "Køberen har bekræftet, at alt er i orden.",
};

/** Så mange billeder kan køberen lægge på en sag. */
export const ISSUE_PHOTOS_MAX = 4;

/** Ved de her grunde skal køberen vise varen, som den ser ud, da den kom. */
export const PHOTO_REASONS: readonly IssueReason[] = ["not_as_shown", "damaged", "counterfeit"];

/** Billeder på en sag ligger altid i køberens egen mappe: <køberens id>/sag-<tilfældigt>.jpg */
export const isIssuePhotoPath = (path: unknown, buyerId: string): path is string =>
  typeof path === "string" && path.startsWith(`${buyerId}/sag-`) && /^[0-9a-f-]{36}\/sag-[a-z0-9-]{4,40}\.jpg$/.test(path);
