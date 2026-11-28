import { fail, json } from "@/lib/api";
import { markHandedInTest } from "@/lib/orders";
import { shipmondoSandbox } from "@/lib/shipmondo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Kun i testfasen (Shipmondos sandbox): sælgeren markerer en pakke med testlabel som afleveret. Testlabels bliver
 * aldrig scannet, så ellers kunne forløbet ikke prøves til ende. Med rigtige labels tæller kun fragtfirmaets
 * scanning (0042_rettelser.sql), og så svarer adressen her nej.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) return fail("Betaling er ikke sat op.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind igen.", 401);
  if (!shipmondoSandbox()) return fail("Pakken bliver markeret som sendt, når fragtfirmaet har scannet den.", 409);
  try {
    if (!(await markHandedInTest(admin, id, uid))) return fail("Ordren kan ikke markeres som sendt.", 409);
    return json({ ok: true });
  } catch (e) {
    console.error("[relived] testlabel kunne ikke markeres som afleveret", id, e);
    return fail("Noget gik galt. Prøv igen.", 500);
  }
}
