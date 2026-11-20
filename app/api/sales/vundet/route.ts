import { fail, json } from "@/lib/api";
import { mailAuctionWins } from "@/lib/orderMails";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Et budsalg er netop slut: vinderen får en mail om at betale. Studiet og seerne kalder den, når uret står på 0.
 * Den kan kaldes af alle, for den gør kun én ting: sender den ene mail til vinderen, og kun én gang (0040).
 */
export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op endnu.", 503);
  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: unknown };
  if (typeof itemId !== "string" || !UUID.test(itemId)) return fail("Ukendt vare.", 400);
  return json({ ok: true, sent: await mailAuctionWins(admin, itemId) });
}
