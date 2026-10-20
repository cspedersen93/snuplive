import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { closeIssue, completeOrder, refundOrder } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Admin afgør en sag: { action: "refund" | "release" | "close" }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return fail("Betaling er ikke sat op.", 503);
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    let ok = false;
    if (action === "refund") ok = await refundOrder(admin, stripe, id, null);
    else if (action === "release") ok = await completeOrder(admin, stripe, id, null, { byAdmin: true });
    else if (action === "close") {
      await closeIssue(admin, id);
      ok = true;
    } else return fail("Ukendt handling.", 400);
    if (!ok) return fail("Ordren kan ikke ændres sådan lige nu. Opdatér siden.", 409);
    console.info("[snuplive] admin", user.email, action, id);
    return json({ ok: true });
  } catch (e) {
    console.error("[snuplive] admin-handling fejlede", action, id, e);
    return fail("Det fejlede hos Stripe. Prøv igen.", 502);
  }
}
