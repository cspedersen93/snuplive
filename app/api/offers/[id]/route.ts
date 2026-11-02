import { after } from "next/server";
import { fail, json } from "@/lib/api";
import { notifyOfferAnswer, type Offer } from "@/lib/offers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Sælgeren svarer på et bud. Body: { accept: true | false }.
 * Ja: varen reserveres til køberen til budet og lander i køberens kurv. Køberen får besked bagefter.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return fail("Log ind igen.", 401);
  const body = (await req.json().catch(() => ({}))) as { accept?: unknown };
  if (typeof body.accept !== "boolean") return fail("Vælg ja eller nej.", 400);

  const { data, error } = await supabase.rpc("answer_offer", { p_offer: id, p_accept: body.accept });
  if (error) {
    if (/answer_offer|schema cache|does not exist/i.test(error.message)) return fail("Bud er ikke slået til endnu.", 503);
    if (/invalid input syntax/i.test(error.message)) return fail("Buddet findes ikke.", 404);
    return fail(error.message.replace(/\.$/, "") + ".", 409);
  }
  const offer = data as Offer;
  const admin = createAdminClient();
  if (admin) {
    after(() =>
      notifyOfferAnswer(admin, offer).catch((e) => console.error("[relived] besked om svar på bud fejlede", e instanceof Error ? e.message : e)),
    );
  }
  return json({ offer });
}
