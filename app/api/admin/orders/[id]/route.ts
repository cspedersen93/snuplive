import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { closeIssue, completeOrder, markShippedByAdmin, refundOrder } from "@/lib/orders";
import { mailIssueDecided } from "@/lib/orderMails";
import { cancelUnusedReturn, coverOrder, ReturnError, startReturn } from "@/lib/returns";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Admin afgør en sag: { action: "refund" | "release" | "close" | "return" | "cover" | "shipped" }.
 * "shipped" er til en pakke, som sporingen ikke har registreret: ordren markeres som sendt og følger så den normale vej.
 */
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
    else if (action === "cover") ok = await coverOrder(admin, stripe, id);
    else if (action === "return") {
      const r = await startReturn(admin, id);
      console.info("[snuplive] admin", user.email, action, id, r);
      return json({ ok: true, ...r });
    } else if (action === "shipped") {
      if (!(await markShippedByAdmin(admin, id))) return fail("Ordren kan ikke ændres sådan lige nu. Opdatér siden.", 409);
      console.info("[relived] admin", user.email, action, id);
      return json({ ok: true });
    } else if (action === "close") {
      await closeIssue(admin, id);
      ok = true;
    } else return fail("Ukendt handling.", 400);
    if (!ok) return fail("Ordren kan ikke ændres sådan lige nu. Opdatér siden.", 409);
    // Afgjort uden retur: en ubrugt returlabel annulleres (refusion er undtaget, for dér kan pakken stadig være på vej).
    if (action !== "refund") await cancelUnusedReturn(admin, id).catch(() => false);
    // Køber og sælger får besked om afgørelsen (ved retur har de allerede fået hver sin mail).
    await mailIssueDecided(admin, id, action as "refund" | "release" | "close" | "cover");
    console.info("[snuplive] admin", user.email, action, id);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ReturnError) return fail(e.message, 409);
    console.error("[snuplive] admin-handling fejlede", action, id, e);
    return fail(action === "cover" ? "Det fejlede hos Stripe. Sagen står stadig åben. Tryk på knappen igen for at gøre den færdig." : "Det fejlede hos Stripe. Prøv igen.", 502);
  }
}
