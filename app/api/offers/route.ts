import { after } from "next/server";
import { fail, json } from "@/lib/api";
import { notifyNewOffer, type Offer } from "@/lib/offers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Køberen giver et bud på en vare til fast pris (0028_bud_paa_varer.sql). Body: { item, amount }.
 * Reglerne (mindst 70 % af prisen, under prisen, højst 3 bud om dagen pr. vare) passer databasen på.
 * Sælgeren får besked bagefter.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return fail("Log ind for at byde.", 401);
  const body = (await req.json().catch(() => ({}))) as { item?: unknown; amount?: unknown };
  const item = typeof body.item === "string" && UUID.test(body.item) ? body.item : null;
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!item) return fail("Varen findes ikke.", 400);
  if (!Number.isInteger(amount) || amount < 1) return fail("Skriv dit bud i hele kroner.", 400);

  const { data, error } = await supabase.rpc("make_offer", { p_item: item, p_amount: amount });
  if (error) {
    if (/make_offer|schema cache|does not exist/i.test(error.message)) return fail("Bud er ikke slået til endnu.", 503);
    return fail(error.message.replace(/\.$/, "") + ".", 400);
  }
  const offer = data as Offer;
  const admin = createAdminClient();
  if (admin) {
    after(() =>
      notifyNewOffer(admin, offer).catch((e) => console.error("[relived] besked om bud fejlede", e instanceof Error ? e.message : e)),
    );
  }
  return json({ offer });
}
