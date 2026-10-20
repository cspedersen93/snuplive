import { fail, json } from "@/lib/api";
import { applyTracking } from "@/lib/orders";
import { hasShipmondo, readWebhook } from "@/lib/shipmondo";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Sporing fra Shipmondo (Shipment Monitor). Skal svare inden for 3 sekunder. */
export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin || !hasShipmondo()) return fail("Fragt er ikke sat op.", 503);
  const payload = readWebhook(await req.text());
  if (!payload) {
    console.error("[snuplive] sporing fra Shipmondo med forkert signatur");
    return fail("Forkert signatur.", 401);
  }
  const data = payload.data as Record<string, unknown> | undefined;
  if (data && data.shipment_id && data.current_status) {
    try {
      await applyTracking(admin, data);
    } catch (e) {
      console.error("[snuplive] sporing kunne ikke gemmes", e);
      return fail("Kunne ikke gemme sporingen.", 500);
    }
  }
  return json({ ok: true });
}
