import { fail, json } from "@/lib/api";
import { completeOrder, confirmPickup, PickupError } from "@/lib/orders";
import { pickupReady } from "@/lib/pickup";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Køberen bekræfter, at varerne er modtaget. Så går pengene videre til sælgeren.
 * Ved afhentning (0041_afhentning.sql) er køberens bekræftelse den ene af to: ordren afsluttes først, når sælgeren
 * også har bekræftet. Svaret siger med `done`, om ordren er afsluttet.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return fail("Betaling er ikke sat op.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind igen.", 401);
  try {
    const { data: o } = await admin.from("orders").select("delivery").eq("id", id).eq("buyer_id", uid).maybeSingle();
    if (o?.delivery === "pickup" && (await pickupReady(admin))) {
      const st = await confirmPickup(admin, stripe, id, uid);
      return json({ ok: true, done: st.done });
    }
    const ok = await completeOrder(admin, stripe, id, uid);
    if (!ok) return fail("Ordren kan ikke bekræftes lige nu.", 409);
    return json({ ok: true, done: true });
  } catch (e) {
    if (e instanceof PickupError) return fail(e.message, 409);
    console.error("[snuplive] bekræft fejlede", e);
    return fail("Noget gik galt. Prøv igen.", 500);
  }
}
