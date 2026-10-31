// Anmeldelser af ting, shows og profiler (EU's regler for digitale tjenester). Se /admin/anmeldelser.

export const REPORT_REASONS = {
  ulovlig: "Det er ulovligt eller må ikke sælges",
  falsk: "Kopivare eller falsk mærke",
  stjaalet: "Jeg tror, det er stjålet",
  farlig: "Farligt, eller det er kaldt tilbage",
  kraenkende: "Krænkende, chikane eller nøgenhed",
  andet: "Andet",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const isReportReason = (v: unknown): v is ReportReason => typeof v === "string" && v in REPORT_REASONS;

export const REPORT_TARGETS = { item: "varen", show: "showet", profile: "profilen" } as const;
export type ReportTarget = keyof typeof REPORT_TARGETS;
export const isReportTarget = (v: unknown): v is ReportTarget => typeof v === "string" && v in REPORT_TARGETS;
