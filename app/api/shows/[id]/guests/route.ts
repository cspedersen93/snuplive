import { RoomServiceClient } from "livekit-server-sdk";
import { fail, json } from "@/lib/api";
import { livekitUrl, unquoteEnv } from "@/lib/env";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: Promise<{ id: string }> };

/** Smid en deltager ud af videoen med det samme (ellers gælder adgangen, til den udløber). */
async function kick(showId: string, identity: string) {
  const url = livekitUrl(process.env.LIVEKIT_URL);
  const key = unquoteEnv(process.env.LIVEKIT_API_KEY);
  const secret = unquoteEnv(process.env.LIVEKIT_API_SECRET);
  if (!url || !key || !secret) return;
  try {
    await new RoomServiceClient(url.replace(/^ws(s?):\/\//i, "http$1://"), key, secret).removeParticipant(showId, identity);
  } catch {
    // Gæsten var ikke på videoen. Det gør ikke noget.
  }
}

/** Værten tager en gæst ud af showet: { guestId }. Gæsten forsvinder også fra videoen med det samme. */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail("Showet findes ikke.", 404);
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return fail("Log ind først.", 401);
  const b = (await req.json().catch(() => null)) as { guestId?: unknown } | null;
  const guestId = typeof b?.guestId === "string" && UUID.test(b.guestId) ? b.guestId : null;
  if (!guestId) return fail("Ukendt gæst.", 400);
  const { error } = await supabase.rpc("guest_remove", { p_show: id, p_guest: guestId });
  if (error) return fail(error.message, 400);
  await kick(id, `cohost:${guestId}`);
  return json({ ok: true });
}
