import { fail, json } from "@/lib/api";
import { isCarrier } from "@/lib/carriers";
import { findPakkeshops, hasShipmondo } from "@/lib/shipmondo";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** De nærmeste DAO- eller GLS-pakkeshops ved et postnummer. Kun for brugere, der er logget ind. */
export async function GET(req: Request) {
  if (!hasShipmondo()) return fail("Fragt er ikke sat op endnu.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind for at vælge pakkeshop.", 401);

  const q = new URL(req.url).searchParams;
  const carrier = q.get("fragt");
  const zip = (q.get("postnr") ?? "").trim();
  const address = (q.get("adresse") ?? "").trim().slice(0, 80) || undefined;
  if (!isCarrier(carrier)) return fail("Vælg DAO eller GLS.", 400);
  if (!/^[0-9]{4}$/.test(zip)) return fail("Skriv et postnummer med 4 cifre.", 400);

  try {
    const points = await findPakkeshops(carrier, zip, { address });
    return json({ points });
  } catch (e) {
    console.error("[snuplive] pakkeshops fejlede", e);
    return fail("Vi kunne ikke hente pakkeshops lige nu. Prøv igen om lidt.", 502);
  }
}
