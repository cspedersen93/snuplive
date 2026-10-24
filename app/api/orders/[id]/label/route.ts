import { NextResponse } from "next/server";
import { fail, json } from "@/lib/api";
import { isLabelWeight } from "@/lib/carriers";
import { createLabelForOrder, LabelError } from "@/lib/orders";
import { hasShipmondo, labelPdf } from "@/lib/shipmondo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Sælgeren laver fragtlabelen. Body: { weight: 1000 | 5000 } (gram). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin || !hasShipmondo()) return fail("Fragtlabels er ikke sat op endnu.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind igen.", 401);
  const body = (await req.json().catch(() => ({}))) as { weight?: unknown };
  if (!isLabelWeight(body.weight)) return fail("Vælg, hvor meget pakken vejer.", 400);
  try {
    const r = await createLabelForOrder(admin, id, uid, body.weight);
    return json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof LabelError) return fail(e.message, 409);
    console.error("[snuplive] label fejlede", id, e);
    return fail("Shipmondo kunne ikke lave labelen. Tjek din afsenderadresse, og prøv igen.", 502);
  }
}

/** Hent labelen som PDF (?format=a4 eller ?format=10x19). Kun sælgeren af ordren. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin || !hasShipmondo()) return fail("Fragtlabels er ikke sat op endnu.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return NextResponse.redirect(new URL(`/login?next=/studio`, req.url), 303);
  const { data: order } = await admin
    .from("orders")
    .select("id,shipmondo_shipment_id")
    .eq("id", id)
    .eq("seller_id", uid)
    .maybeSingle();
  if (!order?.shipmondo_shipment_id) return fail("Labelen findes ikke.", 404);
  const format = new URL(req.url).searchParams.get("format") === "10x19" ? "10x19_pdf" : "a4_pdf";
  try {
    const pdf = await labelPdf(order.shipmondo_shipment_id as number, format);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="relived-label-${id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[snuplive] label-pdf fejlede", id, e);
    return fail("Labelen kunne ikke hentes fra Shipmondo. Prøv igen om lidt.", 502);
  }
}
