import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isToken } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

/** Afmelding fra ventelisten (formularen på /kommer-snart/afmeld). Sender tilbage til siden med en besked. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const token = form?.get("t");
  const back = (q: string) => NextResponse.redirect(new URL(`/kommer-snart/afmeld?${q}`, req.url), 303);
  if (!isToken(token)) return back("fejl=1");
  const admin = createAdminClient();
  if (!admin) return back("fejl=1");
  const { data } = await admin
    .from("waitlist")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsub_token", token)
    .is("unsubscribed_at", null)
    .select("id");
  const { data: exists } = data?.length ? { data } : await admin.from("waitlist").select("id").eq("unsub_token", token);
  return back(exists?.length ? `t=${token}&ok=1` : "fejl=1");
}
