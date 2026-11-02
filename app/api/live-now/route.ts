import { NextResponse } from "next/server";
import { fetchListing } from "@/lib/queries";

// Hvem er live lige nu, til menuen (antal ved "Live nu" og LIVE ved de sælgere, man følger).
// Svaret gemmes i 30 sekunder, så menuen ikke spørger databasen for hver side.
export const revalidate = 30;

export async function GET() {
  const { live } = await fetchListing(50, 0);
  return NextResponse.json({ count: live.length, sellers: live.map((s) => s.seller_id) });
}
