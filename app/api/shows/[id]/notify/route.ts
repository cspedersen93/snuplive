import { fail, json } from "@/lib/api";
import { SITE_URL } from "@/lib/env";
import { sendMailBatch } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Sælgeren er gået live: send én mail til hver, der har trykket "Husk mig". Sker kun én gang pr. show. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) return fail("Ikke sat op.", 503);
  const uid = await getUserId(await createClient());
  if (!uid) return fail("Log ind igen.", 401);

  const { data: claimed } = await admin
    .from("shows")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id)
    .eq("seller_id", uid)
    .eq("status", "live")
    .is("notified_at", null)
    .select("id,title,seller_id");
  const show = claimed?.[0] as { id: string; title: string; seller_id: string } | undefined;
  if (!show) return json({ sent: 0 });
  const { data: prof } = await admin.from("profiles").select("handle").eq("id", show.seller_id).maybeSingle();

  const { data } = await admin.rpc("reminder_recipients", { p_show: id });
  const rows = (data ?? []) as { user_id: string; email: string; items: string[] }[];
  const handle = (prof?.handle as string | undefined) ?? "saelger";
  const link = `${SITE_URL}/live/${handle}`;
  const sent = await sendMailBatch(
    rows
      .filter((r) => r.email)
      .map((r) => ({
        to: r.email,
        subject: `@${handle} er live nu: ${show.title}`,
        text: [
          "Hej",
          "",
          `@${handle} er gået live med showet "${show.title}".`,
          r.items?.length ? `Du bad os huske dig på: ${r.items.join(", ")}.` : "",
          "",
          `Se med og køb: ${link}`,
          "",
          "Du får denne mail, fordi du trykkede Husk mig på Relived.",
        ]
          .filter((l, i, a) => l !== "" || a[i - 1] !== "")
          .join("\n"),
      })),
  );
  return json({ sent });
}
