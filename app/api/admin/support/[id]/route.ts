import { after } from "next/server";
import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { notifyUserNow, staffName, sweepSupportNotices, UUID } from "@/lib/support";
import { SUPPORT_MAX, SUPPORT_THREAD_COLS, type SupportMessage, type SupportThreadRow } from "@/lib/support-shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function guard(ctx: Ctx) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return { error: fail("Ingen adgang.", 403) } as const;
  const admin = createAdminClient();
  if (!admin) return { error: fail("Databasen er ikke sat op.", 503) } as const;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return { error: fail("Samtalen findes ikke.", 404) } as const;
  return { user, admin, id } as const;
}

/** Samtalen med beskeder efter ?after=<id>. Markerer den som læst. */
export async function GET(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const { admin, id } = g;
  const afterId = Math.max(0, Math.floor(Number(new URL(req.url).searchParams.get("after")) || 0));
  const [t, m] = await Promise.all([
    admin.from("support_threads").select(SUPPORT_THREAD_COLS).eq("id", id).maybeSingle(),
    admin.from("support_messages").select("id,sender,author_name,body,created_at").eq("thread_id", id).gt("id", afterId).order("id").limit(500),
  ]);
  if (!t.data) return fail("Samtalen findes ikke.", 404);
  const thread = t.data as unknown as SupportThreadRow;
  if (thread.admin_unread) await admin.from("support_threads").update({ admin_unread: false, admin_seen_at: new Date().toISOString() }).eq("id", id);
  after(() => sweepSupportNotices(admin));
  return json({ thread: { ...thread, admin_unread: false }, messages: (m.data ?? []) as SupportMessage[] });
}

/** Svar: { body }. Har brugeren ikke chatten åben, får de svaret på mail med det samme. */
export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const { admin, id, user } = g;
  const { body } = (await req.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return fail("Skriv et svar.", 400);
  if (text.length > SUPPORT_MAX) return fail(`Svaret er for langt (højst ${SUPPORT_MAX} tegn).`, 400);
  const { data: me } = await admin.from("profiles").select("handle,display_name").eq("id", user.id).maybeSingle<{ handle: string; display_name: string | null }>();
  const { data, error } = await admin.rpc("support_add", {
    p_thread: id,
    p_sender: "admin",
    p_author: user.id,
    p_author_name: staffName(me ?? null),
    p_body: text,
  });
  if (error) return fail(/findes ikke/.test(error.message) ? "Samtalen findes ikke." : error.message, /findes ikke/.test(error.message) ? 404 : 400);
  const mailed = await notifyUserNow(admin, id);
  console.info("[snuplive] admin", user.email, "svarede i support", id);
  return json({ message: (data as { message: SupportMessage }).message, mailed });
}

/** Luk eller åbn samtalen: { status: "open" | "closed" }. */
export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const { status } = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (status !== "open" && status !== "closed") return fail("Ukendt status.", 400);
  const { error } = await g.admin
    .from("support_threads")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null, admin_unread: false })
    .eq("id", g.id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
}

/** Slet samtalen (fx spam). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const { error } = await g.admin.from("support_threads").delete().eq("id", g.id);
  if (error) return fail(error.message, 500);
  console.info("[snuplive] admin", g.user.email, "slettede supportsamtale", g.id);
  return json({ ok: true });
}
