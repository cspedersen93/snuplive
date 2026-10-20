import { fail, json } from "@/lib/api";
import { refundOrder } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Sælgeren kan ikke levere: køberen får alle pengene tilbage. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return fail("Betaling er ikke sat op.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind igen.", 401);
  try {
    const ok = await refundOrder(admin, stripe, id, uid);
    if (!ok) return fail("Ordren kan ikke refunderes.", 409);
    return json({ ok: true });
  } catch (e) {
    console.error("[snuplive] refundering fejlede", e);
    return fail("Refunderingen fejlede hos Stripe. Prøv igen.", 502);
  }
}
