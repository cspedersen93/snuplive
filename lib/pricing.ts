// Priser og regler for betaling. Bruges både i browseren og på serveren,
// men serveren regner altid beløbene ud igen, før der bliver trukket penge.

export const DELIVERY = {
  ship: {
    label: "Levering til pakkeshop",
    short: "Pakkeshop",
    price: 49,
    note: "Sendes med DAO eller GLS. Samme pris op til 5 kg.",
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
  const shipping: number = DELIVERY[delivery].price;
  const fee = buyerFee(items);
  return { items, shipping, fee, total: items + shipping + fee };
}

/**
 * Det, sælgeren får for en ordre. Går pakken til en pakkeshop med SnupLives label (sp_id er sat),
 * betaler fragten labelen, og sælgeren får beløbet for tingene. Ellers får sælgeren også fragten.
 */
export function sellerPayout(o: { items_amount: number; shipping_amount: number; sp_id?: string | null }) {
  return o.items_amount + (o.sp_id ? 0 : o.shipping_amount);
}

/** Et snup, der ikke er betalt efter så mange dage, bliver annulleret. */
export const RESERVATION_DAYS = 3;
/** Så mange dage efter afsendelse bliver ordren afsluttet, hvis køberen ikke selv bekræfter. */
export const AUTO_COMPLETE_DAYS = 7;
/** Så mange dage efter, at pakken er hentet i pakkeshoppen, bliver ordren afsluttet. */
export const DELIVERED_COMPLETE_DAYS = 2;
