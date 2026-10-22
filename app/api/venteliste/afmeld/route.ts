import { NextResponse } from "next/server";
import { json } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isToken } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

/**
 * Afmelding fra ventelisten.
 * - Formularen på /kommer-snart/afmeld sender t i formularen og får siden tilbage med en besked.
 * - Mailprogrammer (afmeld med ét klik) sender POST til ?t=… med "List-Unsubscribe=One-Click" og får bare 200.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const form = await req.formData().catch(() => null);
  const oneClick = form?.get("List-Unsubscribe") === "One-Click";
  const token = form?.get("t") ?? url.searchParams.get("t");
  const back = (q: string) => NextResponse.redirect(new URL(`/kommer-snart/afmeld?${q}`, req.url), 303);
  const admin = createAdminClient();
  if (!isToken(token) || !admin) return oneClick ? json({ ok: false }, 400) : back("fejl=1");

  await admin.from("waitlist").update({ unsubscribed_at: new Date().toISOString() }).eq("unsub_token", token).is("unsubscribed_at", null);
  const { data: exists } = await admin.from("waitlist").select("id").eq("unsub_token", token);
  if (oneClick) return json({ ok: Boolean(exists?.length) });
  return back(exists?.length ? `t=${token}&ok=1` : "fejl=1");
}
