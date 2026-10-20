// Fragtfirmaer og sporing. Bruges både i browseren og på serveren.

export type CarrierCode = "dao" | "gls";

export const CARRIERS: Record<CarrierCode, { name: string; track: (no: string) => string }> = {
  dao: { name: "DAO", track: (no) => `https://www.dao.as/privat/find-din-pakke?stregkode=${encodeURIComponent(no)}` },
  gls: { name: "GLS", track: (no) => `https://gls-group.com/DK/da/find-pakke?match=${encodeURIComponent(no)}` },
};

export const CARRIER_CODES = Object.keys(CARRIERS) as CarrierCode[];

export const isCarrier = (v: unknown): v is CarrierCode => v === "dao" || v === "gls";

/** Den pakkeshop, køberen har valgt. */
export interface Pakkeshop {
  carrier: CarrierCode;
  id: string;
  name: string;
  address: string;
  zipcode: string;
  city: string;
  distance: number | null;
  hours: string[];
}

/** Vægtklasser, sælgeren vælger imellem, når labelen laves. Køberen betaler det samme uanset vægt. */
export const LABEL_WEIGHTS = [
  { grams: 1000, label: "Op til 1 kg", hint: "Fx tøj og vinyl" },
  { grams: 5000, label: "1–5 kg", hint: "Fx sko, jakker og flere ting" },
] as const;

export const isLabelWeight = (v: unknown): v is number => LABEL_WEIGHTS.some((w) => w.grams === v);

/** Sporingens status (fra Shipmondo) som tekst til køber og sælger. */
export const TRACKING_TEXT: Record<string, string> = {
  INFORMED: "Labelen er lavet. Pakken er ikke afleveret endnu.",
  PICKUP_REQUESTED: "Pakken venter på at blive hentet af fragtfirmaet.",
  EN_ROUTE: "Pakken er på vej.",
  AVAILABLE_FOR_DELIVERY: "Pakken er klar til afhentning i pakkeshoppen.",
  DELIVERED: "Pakken er hentet i pakkeshoppen.",
  GENERAL: "Fragtfirmaet har registreret pakken.",
};

export function trackingText(status: string | null | undefined) {
  return status ? (TRACKING_TEXT[status] ?? TRACKING_TEXT.GENERAL) : null;
}

export function distanceText(m: number | null) {
  if (m === null || !Number.isFinite(m)) return "";
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
