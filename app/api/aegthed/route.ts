import { after } from "next/server";
import { fail, json } from "@/lib/api";
import { SITE_URL } from "@/lib/env";
import { kr } from "@/lib/format";
import { adminEmails, sendMail } from "@/lib/mail";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sælgeren sender sine billeder til ægthedstjek. Admins får en mail. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (!uid) return fail("Log ind igen.", 401);
  const b = (await req.json().catch(() => null)) as { itemId?: unknown; photos?: unknown } | null;
  const itemId = typeof b?.itemId === "string" ? b.itemId : "";
  const photos = Array.isArray(b?.photos) ? b.photos.filter((x): x is string => typeof x === "string") : [];
  if (!UUID.test(itemId)) return fail("Ukendt vare.", 400);

  // Reglerne (sælgerens egen ting, 4-8 billeder i den rigtige mappe) tjekkes i databasen.
  const { data, error } = await supabase.rpc("submit_auth", { p_item: itemId, p_photos: photos });
  if (error) {
    const msg = /function .*submit_auth|does not exist/i.test(error.message) ? "Ægthedstjek er ikke sat op endnu." : error.message;
    return fail(msg, 400);
  }
  const item = data as { id: string; name: string; price: number } | null;
  const { data: prof } = await supabase.from("profiles").select("handle").eq("id", uid).maybeSingle();
  const to = adminEmails();
  if (item && to.length) {
    after(() =>
      sendMail({
        to,
        subject: `Ægthedstjek: ${item.name} (${kr(item.price)})`,
        text: [
          `@${prof?.handle ?? "en sælger"} har sendt "${item.name}" (${kr(item.price)}) til ægthedstjek.`,
          "",
          `Se billederne, og godkend eller afvis: ${SITE_URL}/admin/aegthed`,
          "",
          "Varen kan ikke vises live eller købes, før den er godkendt.",
        ].join("\n"),
      }),
    );
  }
  return json({ status: "pending" });
}
