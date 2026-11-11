import { fail, json } from "@/lib/api";
import { POST_IMAGES_MAX, POST_MAX } from "@/lib/posts";
import { sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * En sælger skriver et opslag: { body, images?: string[], show_id?: string }.
 * Opslaget gemmes som sælgeren selv (databasen tjekker, at det er en sælger og sælgerens egne billeder og show),
 * og følgerne får en besked på telefonen.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const uid = await getUserId(sb);
  if (!uid) return fail("Log ind for at skrive et opslag.", 401);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const body = typeof b.body === "string" ? b.body.trim() : "";
  if (!body) return fail("Skriv noget i opslaget.", 400);
  if (body.length > POST_MAX) return fail(`Opslaget må højst være ${POST_MAX} tegn.`, 400);
  const images = Array.isArray(b.images) ? b.images.filter((x): x is string => typeof x === "string").slice(0, POST_IMAGES_MAX) : [];
  const showId = typeof b.show_id === "string" && UUID.test(b.show_id) ? b.show_id : null;

  const { data, error } = await sb.from("posts").insert({ seller_id: uid, body, images, show_id: showId }).select("id").maybeSingle();
  if (error) {
    // Tabellen findes først, når 0037_profil_opslag.sql er kørt.
    if (error.code === "42P01" || error.code === "PGRST205") return fail("Opslag er ikke slået til endnu.", 503);
    if (error.code === "42501") return fail("Kun sælgere kan skrive opslag.", 403);
    return fail(error.message || "Opslaget kunne ikke gemmes.", 400);
  }
  const id = (data as { id: string } | null)?.id ?? null;

  // Besked til følgerne. Går det galt, er opslaget stadig gemt.
  let pushed = 0;
  const admin = createAdminClient();
  if (admin && id) {
    try {
      const [me, fol] = await Promise.all([
        admin.from("profiles").select("handle").eq("id", uid).maybeSingle(),
        admin.from("follows").select("follower_id").eq("seller_id", uid).limit(5000),
      ]);
      const handle = (me.data as { handle: string } | null)?.handle;
      const ids = fol.error ? [] : (fol.data ?? []).map((r) => (r as { follower_id: string }).follower_id);
      if (handle && ids.length) {
        const got = await sendPush(admin, ids, {
          title: `${handle} har skrevet et opslag`,
          body: body.length > 110 ? `${body.slice(0, 107)}…` : body,
          url: `/profil/${handle}#opslag-${id}`,
          tag: `opslag-${id}`,
        });
        pushed = got.size;
      }
    } catch (e) {
      console.error("[snuplive] besked om opslag kunne ikke sendes", e);
    }
  }
  return json({ ok: true, id, pushed });
}
