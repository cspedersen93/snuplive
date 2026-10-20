// Priser og regler for betaling. Bruges både i browseren og på serveren,
// men serveren regner altid beløbene ud igen, før der bliver trukket penge.

export const DELIVERY = {
  ship: {
    label: "Levering til pakkeshop",
    short: "Pakkeshop",
    price: 39,
    note: "Sælgeren sender pakken til en pakkeshop nær din adresse.",
  },
  pickup: {
    label: "Afhent hos sælgeren",
    short: "Afhentning",
    price: 0,
    note: "I aftaler tid og sted. Sælgeren får dit telefonnummer.",
  },
} as const;

export type Delivery = keyof typeof DELIVERY;

export const isDelivery = (v: unknown): v is Delivery => v === "ship" || v === "pickup";

/** Køberbeskyttelse pr. pakke: 5 % af tingene + 5 kr. */
export function buyerFee(items: number) {
  return items > 0 ? Math.round(items * 0.05) + 5 : 0;
}

export function orderAmounts(items: number, delivery: Delivery) {
  const shipping = DELIVERY[delivery].price;
  const fee = buyerFee(items);
  return { items, shipping, fee, total: items + shipping + fee, payout: items + shipping };
}

/** Et snup, der ikke er betalt efter så mange dage, bliver annulleret. */
export const RESERVATION_DAYS = 3;
/** Så mange dage efter afsendelse bliver ordren afsluttet, hvis køberen ikke selv bekræfter. */
export const AUTO_COMPLETE_DAYS = 7;
