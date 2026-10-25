import { after } from "next/server";
import { fail, json } from "@/lib/api";
import { SITE_URL } from "@/lib/env";
import { isAdminEmail, sendMail } from "@/lib/mail";
import { itemHref } from "@/lib/items";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: Promise<{ id: string }> };

/** Godkend eller afvis et ægthedstjek: { decision: "approve" | "reject", note }. Sælgeren får besked på mail. */
export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail("Tingen findes ikke.", 404);
  const b = (await req.json().catch(() => null)) as { decision?: unknown; note?: unknown } | null;
  const decision = b?.decision === "approve" ? "approved" : b?.decision === "reject" ? "rejected" : null;
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 500) : "";
  if (!decision) return fail("Vælg godkend eller afvis.", 400);
  if (decision === "rejected" && note.length < 5) return fail("Skriv kort, hvorfor den er afvist.", 400);

  const { data, error } = await admin
    .from("items")
    .update({ auth_status: decision, auth_note: note || null, auth_at: new Date().toISOString(), auth_by: user.id })
    .eq("id", id)
    .eq("auth_status", "pending")
    .select("id,name,seller_id")
    .maybeSingle();
  if (error) return fail(error.message, 400);
  if (!data) return fail("Tingen er allerede afgjort eller findes ikke.", 409);

  const item = data as { id: string; name: string; seller_id: string };
  const { data: u } = await admin.auth.admin.getUserById(item.seller_id);
  const to = u?.user?.email;
  if (to) {
    const link = `${SITE_URL}${itemHref(item)}`;
    after(() =>
      sendMail({
        to: [to],
        subject: decision === "approved" ? `Ægthed tjekket: ${item.name}` : `Ægthedstjek afvist: ${item.name}`,
        text: (decision === "approved"
          ? [
              "Hej",
              "",
              `Vi har ægthedstjekket "${item.name}", og den er godkendt. Den kan nu vises live og købes, og den har mærket Ægthed tjekket.`,
              note ? `\nBesked fra Relived: ${note}` : "",
              "",
              `Se tingen: ${link}`,
            ]
          : [
              "Hej",
              "",
              `Vi kunne ikke godkende "${item.name}" i ægthedstjekket.`,
              "",
              `Begrundelse: ${note}`,
              "",
              "Du kan sende nye billeder under Mine shows → showet → Send nye billeder. Indtil den er godkendt, kan den ikke vises live eller købes.",
            ]
        )
          .filter((l, i, a) => l !== "" || a[i - 1] !== "")
          .join("\n"),
      }),
    );
  }
  return json({ ok: true });
}
