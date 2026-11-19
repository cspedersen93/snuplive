import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { hasShipmondo, labelPdf } from "@/lib/shipmondo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Køberen henter returlabelen som PDF. Kun køberen af ordren, og kun når Relived har lavet en returlabel. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin || !hasShipmondo()) return fail("Fragtlabels er ikke sat op endnu.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return NextResponse.redirect(new URL(`/login?next=/kurv`, req.url), 303);
  const { data: order } = await admin.from("orders").select("id").eq("id", id).eq("buyer_id", uid).maybeSingle();
  if (!order) return fail("Labelen findes ikke.", 404);
  const { data: ret, error } = await admin.from("order_returns").select("shipment_id").eq("order_id", id).maybeSingle();
  if (error || !ret?.shipment_id) return fail("Labelen findes ikke.", 404);
  try {
    const pdf = await labelPdf(ret.shipment_id as number, "a4_pdf");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="relived-retur-${id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[relived] returlabel kunne ikke hentes", id, e);
    return fail("Labelen kunne ikke hentes lige nu. Prøv igen om lidt.", 502);
  }
}
