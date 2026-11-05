import { fail, json } from "@/lib/api";
import { rateLimiter } from "@/lib/claude";
import { startSubtitles, stopSubtitles, subtitleKeyterms, subtitlesOn } from "@/lib/subtitles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tooMany = rateLimiter(20, 10 * 60_000);

/** Værten af showet, eller en fejl. */
async function hostShow(id: string) {
  if (!UUID.test(id)) return { error: fail("Ukendt show.", 400) };
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return { error: fail("Log ind igen.", 401) };
  if (tooMany(uid)) return { error: fail("Prøv igen om lidt.", 429) };
  const { data: show } = await supabase.from("shows").select("id,seller_id,status").eq("id", id).maybeSingle();
  if (!show || show.seller_id !== uid) return { error: fail("Kun værten kan styre underteksterne.", 403) };
  return { show: show as { id: string; seller_id: string; status: string } };
}

/**
 * Værten er live (eller slår underteksterne til igen): send programmet ind i showet.
 * Gør ingenting, hvis kontakten i Backoffice er slået fra, eller programmet allerede er der.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await hostShow(id);
  if (r.error) return r.error;
  if (!(await subtitlesOn())) return json({ on: false });
  if (r.show.status !== "live") return fail("Showet er ikke live.", 409);
  const admin = createAdminClient();
  const { data: items } = admin
    ? await admin.from("items").select("name").eq("show_id", id).in("status", ["queued", "live"]).is("removed_at", null).limit(60)
    : { data: [] };
  try {
    await startSubtitles(id, subtitleKeyterms(((items ?? []) as { name: string }[]).map((i) => i.name)));
  } catch (e) {
    console.error("[relived] undertekster kunne ikke starte", id, e);
    return fail("Underteksterne kunne ikke starte.", 502);
  }
  return json({ on: true });
}

/** Værten slår underteksterne fra, eller showet slutter. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await hostShow(id);
  if (r.error) return r.error;
  try {
    await stopSubtitles(id);
  } catch (e) {
    console.error("[relived] undertekster kunne ikke stoppe", id, e);
  }
  return json({ on: false });
}
