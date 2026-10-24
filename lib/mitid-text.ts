/** Svaret fra MitID efter et forsøg: vises som en besked på siden. */
export const MITID_RESULT: Record<string, string> = {
  ok: "Tak. Du har bekræftet, hvem du er, med MitID.",
  afbrudt: "MitID blev afbrudt. Prøv igen, når du er klar.",
  brugt: "Det MitID er allerede brugt på en anden Relived-konto. Skriv til kontakt@relived.dk, hvis det er en fejl.",
  alder: "Du skal være fyldt 18 år for at sælge på Relived.",
  fejl: "Noget gik galt med MitID. Prøv igen om lidt.",
  off: "MitID er ikke slået til endnu.",
};
