import { fail, json } from "@/lib/api";
import { completeOrder } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Køberen bekræfter, at tingene er modtaget. Så går pengene videre til sælgeren. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return fail("Betaling er ikke sat op.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind igen.", 401);
  try {
    const ok = await completeOrder(admin, stripe, id, uid);
    if (!ok) return fail("Ordren kan ikke bekræftes lige nu.", 409);
    return json({ ok: true });
  } catch (e) {
    console.error("[snuplive] bekræft fejlede", e);
    return fail("Noget gik galt. Prøv igen.", 500);
  }
}
