// Budsalg: samme regler som i databasen (bid_step og next_bid i 0008_budsalg.sql).

export const AUCTION_SECONDS = 30;
export const EXTEND_SECONDS = 10;

/** 5 kr under 100 kr, 10 kr op til 500 kr, 25 kr op til 1.000 kr og 50 kr derover. */
export function bidStep(amount: number) {
  if (amount < 100) return 5;
  if (amount < 500) return 10;
  if (amount < 1000) return 25;
  return 50;
}

/** Det mindste bud lige nu: startprisen, eller det højeste bud plus ét trin. */
export function nextBid(price: number, high: number | null | undefined) {
  return high == null ? price : high + bidStep(high);
}

export const isAuction = (it: { sale_type?: string | null }) => it.sale_type === "auction";

/** Det, tingen blev solgt for: det vindende bud på et budsalg, ellers prisen. */
export function soldPrice(it: { sale_type?: string | null; price: number; high_bid?: number | null }) {
  return isAuction(it) && it.high_bid ? it.high_bid : it.price;
}

/** Sekunder tilbage af budsalget (0, når det er slut), eller null, hvis det ikke er startet. */
export function auctionLeft(it: { auction_ends_at?: string | null }, now: number) {
  return it.auction_ends_at ? Math.max(0, Math.ceil((Date.parse(it.auction_ends_at) - now) / 1000)) : null;
}
