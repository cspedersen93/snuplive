import { fail, json } from "@/lib/api";
import { confirmPickup, PickupError } from "@/lib/orders";
import { missingColumn, pickupReady } from "@/lib/pickup";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Afhentning (0041_afhentning.sql): hvem har bekræftet? Siden spørger, mens køber og sælger står sammen,
 * så den ene kan se, når den anden har trykket. Kun køberen og sælgeren kan læse ordren (RLS).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return fail("Log ind igen.", 401);
  const { data, error } = await supabase.from("orders").select("status,pickup_buyer_at,pickup_seller_at").eq("id", id).maybeSingle();
  if (error) return fail(missingColumn(error) ? "Afhentning kan ikke bekræftes her endnu." : "Noget gik galt. Prøv igen.", missingColumn(error) ? 409 : 500);
  if (!data) return fail("Ordren findes ikke.", 404);
  const o = data as { status: string; pickup_buyer_at: string | null; pickup_seller_at: string | null };
  return json({ status: o.status, buyer: Boolean(o.pickup_buyer_at), seller: Boolean(o.pickup_seller_at), done: o.status === "completed" });
}

/** Køber eller sælger bekræfter afhentningen. Når begge har gjort det, afsluttes ordren, og pengene går til sælgeren. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return fail("Betaling er ikke sat op.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind igen.", 401);
  try {
    if (!(await pickupReady(admin))) return fail("Afhentning kan ikke bekræftes her endnu.", 409);
    return json({ ok: true, ...(await confirmPickup(admin, stripe, id, uid)) });
  } catch (e) {
    if (e instanceof PickupError) return fail(e.message, 409);
    console.error("[relived] bekræft afhentning fejlede", id, e);
    return fail("Noget gik galt. Prøv igen.", 500);
  }
}
