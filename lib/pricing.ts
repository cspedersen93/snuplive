// Priser og regler for betaling. Bruges både i browseren og på serveren,
// men serveren regner altid beløbene ud igen, før der bliver trukket penge.

/**
 * Fragten følger pakkens størrelse: lille op til 1 kg, stor op til 5 kg. Det er de samme to vægtklasser, sælgeren
 * vælger imellem, når labelen laves (lib/carriers.ts). Labelen koster ca. 34,80 kr (op til 1 kg) og 39,80 kr (op til 5 kg)
 * uden moms hos Shipmondo (oktober 2026).
 */
export const PARCELS = {
  small: { label: "Lille pakke", weight: "op til 1 kg", price: 39, grams: 1000 },
  large: { label: "Stor pakke", weight: "1–5 kg", price: 49, grams: 5000 },
} as const;
export type Parcel = keyof typeof PARCELS;
export const isParcel = (v: unknown): v is Parcel => v === "small" || v === "large";

/** Kategorier, hvor en vare som udgangspunkt er en stor pakke. Sælgeren kan ændre det på varen. */
export const LARGE_CATEGORIES: readonly string[] = ["bolig", "cykler"];

/** Pakkestørrelsen på én vare: sælgerens valg (items.package_size), ellers kategoriens standard. */
export function itemParcel(i: { package_size?: string | null; category?: string | null }, showCategory?: string | null): Parcel {
  if (isParcel(i.package_size)) return i.package_size;
  return LARGE_CATEGORIES.includes(i.category ?? showCategory ?? "") ? "large" : "small";
}

/**
 * Pakken for alt, køberen har købt hos én sælger. En lille vare tæller som et halvt kilo og en stor som to,
 * så to kjoler er stadig en lille pakke, mens tre varer eller én stor vare giver en stor pakke.
 */
export function parcelFor(items: Parcel[]): Parcel {
  const grams = items.reduce((a, p) => a + (p === "large" ? 2000 : 500), 0);
  return grams <= PARCELS.small.grams ? "small" : "large";
}

/** "39 kr op til 1 kg og 49 kr op til 5 kg" */
export const SHIP_PRICES_TEXT = `${PARCELS.small.price} kr op til 1 kg og ${PARCELS.large.price} kr op til 5 kg`;

export const DELIVERY = {
  ship: {
    label: "Levering til pakkeshop",
    short: "Pakkeshop",
    /** Den laveste fragt ("fra 39 kr"). Den rigtige pris følger pakken, se PARCELS. */
    price: PARCELS.small.price,
    note: "Sendes med DAO eller GLS.",
  },
  pickup: {
    label: "Afhent hos sælgeren",
    short: "Afhentning",
    price: 0,
    note: "I aftaler tid og sted. Sælgeren får dit telefonnummer.",
  },
} as const;

export type Delivery = keyof typeof DELIVERY;

/** Kategorier, hvor varen normalt er for stor til en pakkeshop. I kurven er afhentning valgt på forhånd. */
export const PICKUP_CATEGORIES: readonly string[] = ["cykler"];

export const isDelivery = (v: unknown): v is Delivery => v === "ship" || v === "pickup";

/** Køberbeskyttelse pr. pakke: 5 % af tingene + 5 kr. */
export function buyerFee(items: number) {
  return items > 0 ? Math.round(items * 0.05) + 5 : 0;
}

/**
 * Beløbene for én pakke. `items` er varernes samlede pris, `discount` samlerabatten (se bundleDiscount), `parcel` pakkens størrelse.
 * I svaret er `items` beløbet efter rabatten: det, sælgeren får for varerne. Køberbeskyttelsen regnes af det.
 */
export function orderAmounts(items: number, delivery: Delivery, discount = 0, parcel: Parcel = "small", feeFree = false) {
  const net = Math.max(0, items - Math.max(0, discount));
  const shipping: number = delivery === "ship" ? PARCELS[parcel].price : 0;
  // Gratis-kampagnen (lib/feeFree.ts): gebyret er 0 kr, beskyttelsen gælder stadig.
  const fee = feeFree ? 0 : buyerFee(net);
  return { gross: items, discount: items - net, items: net, shipping, fee, total: net + shipping + fee };
}

// ─────────────────────────────────────────────────────────────────────────────
// Samlerabat (0027_samlerabat.sql): sælgerens rabat, når køberen køber flere varer hos hende.
// ─────────────────────────────────────────────────────────────────────────────

/** Rabat i procent ved 2 varer og ved 3 eller flere. 0 = ingen. */
export interface BundleTiers {
  pct2: number;
  pct3: number;
}

/** De rabatter, sælgeren kan vælge imellem. */
export const BUNDLE_STEPS = [0, 5, 10, 15, 20, 25, 30] as const;

export const hasBundle = (b?: BundleTiers | null): b is BundleTiers => Boolean(b && (b.pct2 > 0 || b.pct3 > 0));

/** Rabatten i procent for så mange varer fra samme sælger. */
export function bundlePct(count: number, b?: BundleTiers | null) {
  if (!b || count < 2) return 0;
  return count >= 3 ? Math.max(b.pct2, b.pct3) : b.pct2;
}

/** Samlerabatten i kroner for varer til `gross` kr i alt. */
export function bundleDiscount(gross: number, count: number, b?: BundleTiers | null) {
  const pct = bundlePct(count, b);
  return pct > 0 ? Math.round((gross * pct) / 100) : 0;
}

/** Næste trin, køberen kan nå: "Køb 1 vare mere, og spar 15 %". */
export function nextBundle(count: number, b?: BundleTiers | null): { more: number; pct: number } | null {
  if (!hasBundle(b)) return null;
  const now = bundlePct(count, b);
  if (count < 2 && b.pct2 > 0) return { more: 2 - count, pct: b.pct2 };
  const three = Math.max(b.pct2, b.pct3);
  if (count < 3 && three > now) return { more: 3 - count, pct: three };
  return null;
}

/** "10 % ved 2 varer · 15 % ved 3 eller flere" */
export function bundleText(b?: BundleTiers | null) {
  if (!hasBundle(b)) return "";
  const three = Math.max(b.pct2, b.pct3);
  if (!b.pct2) return `${three} % ved 3 eller flere varer`;
  if (three === b.pct2) return `${b.pct2} % ved 2 eller flere varer`;
  return `${b.pct2} % ved 2 varer · ${three} % ved 3 eller flere`;
}

/**
 * Fordeler rabatten på varerne i hele kroner, så summen passer præcist (til linjerne hos Stripe).
 * Giver priserne efter rabat i samme rækkefølge.
 */
export function spreadDiscount(prices: number[], discount: number) {
  const gross = prices.reduce((a, p) => a + p, 0);
  if (discount <= 0 || gross <= 0) return [...prices];
  const cut = prices.map((p) => Math.floor((discount * p) / gross));
  let rest = discount - cut.reduce((a, c) => a + c, 0);
  // Resten tages fra de dyreste varer først, én krone ad gangen.
  const order = prices.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length) {
    const i = order[k][1];
    if (prices[i] - cut[i] > 1) {
      cut[i] += 1;
      rest -= 1;
    } else if (order.every(([, j]) => prices[j] - cut[j] <= 1)) break;
  }
  return prices.map((p, i) => p - cut[i]);
}

/**
 * Det, sælgeren får for en ordre. Går pakken til en pakkeshop med Reliveds label (sp_id er sat),
 * betaler fragten labelen, og sælgeren får beløbet for tingene. Ellers får sælgeren også fragten.
 */
export function sellerPayout(o: { items_amount: number; shipping_amount: number; sp_id?: string | null }) {
  return o.items_amount + (o.sp_id ? 0 : o.shipping_amount);
}

// Bud på varer til fast pris (0028_bud_paa_varer.sql).
/** Et bud gælder så mange timer. */
export const OFFER_HOURS = 48;
/** Mindste bud i procent af prisen. Samme regel som offer_min i databasen. */
export const OFFER_MIN_PCT = 70;
export const offerMin = (price: number) => Math.ceil((price * OFFER_MIN_PCT) / 100);

/** Et køb, der ikke er betalt efter så mange dage, bliver annulleret. */
export const RESERVATION_DAYS = 3;
/** Så mange dage efter afsendelse bliver ordren afsluttet, hvis køberen ikke selv bekræfter. */
export const AUTO_COMPLETE_DAYS = 7;
/** Så mange dage efter, at pakken er hentet i pakkeshoppen, bliver ordren afsluttet. */
export const DELIVERED_COMPLETE_DAYS = 2;
