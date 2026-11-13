import { fail, json } from "@/lib/api";
import { ISSUE_PHOTOS_MAX, isIssuePhotoPath, isIssueReason, PHOTO_REASONS } from "@/lib/issues";
import { IssueError, reportIssue } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Køberen melder et problem med en ordre. Body: { reason, message, photos }. Pengene holdes tilbage. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) return fail("Betaling er ikke sat op.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind igen.", 401);
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown; message?: unknown; photos?: unknown; photosReady?: unknown };
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!isIssueReason(body.reason)) return fail("Vælg, hvad problemet er.", 400);
  if (message.length < 10) return fail("Skriv lidt mere om, hvad der er galt (mindst 10 tegn).", 400);
  const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
  if (rawPhotos.length > ISSUE_PHOTOS_MAX) return fail(`Du kan højst vedhæfte ${ISSUE_PHOTOS_MAX} billeder.`, 400);
  if (!rawPhotos.every((p) => isIssuePhotoPath(p, uid))) return fail("Et af billederne kunne ikke bruges. Prøv at vælge det igen.", 400);
  const photos = [...new Set(rawPhotos as string[])];
  // Billeder kræves kun, når siden selv har vist feltet (dvs. når databasen er klar til dem).
  if (body.photosReady === true && PHOTO_REASONS.includes(body.reason) && photos.length === 0) {
    return fail("Vedhæft mindst ét billede af varen, som den ser ud nu.", 400);
  }
  if (body.reason === "withdrawal") {
    const { data: o } = await admin.from("orders").select("seller:profiles!orders_seller_id_fkey(seller_type)").eq("id", id).maybeSingle();
    const type = (o as unknown as { seller: { seller_type: string | null } | null } | null)?.seller?.seller_type;
    if (type !== "business") return fail("Fortrydelsesret gælder kun, når du køber af en virksomhed.", 400);
  }
  try {
    await reportIssue(admin, id, uid, body.reason, message, photos);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof IssueError) return fail(e.message, 409);
    console.error("[snuplive] problem kunne ikke meldes", id, e);
    return fail("Noget gik galt. Prøv igen, eller skriv til kontakt@relived.dk.", 500);
  }
}
