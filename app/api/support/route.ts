import { cookies } from "next/headers";
import { after } from "next/server";
import { fail, json } from "@/lib/api";
import { cleanPage, ipHash, mailAdminsAboutSupport, SUPPORT_COOKIE, supportCookie, sweepSupportNotices, UUID } from "@/lib/support";
import { SUPPORT_MAX, type SupportMessage } from "@/lib/support-shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COLS = "id,token,user_id,email,name,status,page,user_agent,user_seen_at";
const MSG_COLS = "id,sender,author_name,body,created_at";

interface Thread {
  id: string;
  token: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  status: "open" | "closed";
  page: string | null;
  user_agent: string | null;
  user_seen_at: string | null;
}

/**
 * Hvem spørger, og hvilken samtale er deres? Samtalen findes ud fra cookien. Hører den til en konto,
 * skal man være logget ind på den konto for at se den. Er man logget ind uden cookie (fx på en ny
 * telefon), får man sin seneste samtale fra de sidste 90 dage.
 */
async function context() {
  const admin = createAdminClient();
  const user = await getUserInfo(await createClient());
  const cookie = (await cookies()).get(SUPPORT_COOKIE)?.value ?? "";
  let thread: Thread | null = null;
  let needLogin = false;
  if (admin && UUID.test(cookie)) {
    const { data } = await admin.from("support_threads").select(COLS).eq("token", cookie).maybeSingle<Thread>();
    if (data && (!data.user_id || data.user_id === user?.id)) thread = data;
    else if (data && !user) needLogin = true;
  }
  if (admin && !thread && user) {
    const since = new Date(Date.now() - 90 * 864e5).toISOString();
    const { data } = await admin
      .from("support_threads")
      .select(COLS)
      .eq("user_id", user.id)
      .gte("last_message_at", since)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle<Thread>();
    thread = data ?? null;
  }
  return { admin, user, thread, needLogin, cookie };
}

const known = /mange beskeder|For mange nye|travlt|for lang|Skriv en besked/;

/** Hent samtalen: ?after=<id> for nye beskeder, &open=1 når chatten er åben, ?peek=1 for antal ulæste. */
export async function GET(req: Request) {
  const { admin, user, thread, needLogin, cookie } = await context();
  if (!admin) return json({ enabled: false });
  after(() => sweepSupportNotices(admin));
  const url = new URL(req.url);
  const viewer = { loggedIn: Boolean(user), email: user?.email ?? null };
  if (!thread) return json({ enabled: true, viewer, needLogin, thread: null, messages: [], unread: 0 });

  if (url.searchParams.get("peek")) {
    const { count } = await admin
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", thread.id)
      .eq("sender", "admin")
      .gt("created_at", thread.user_seen_at ?? "1970-01-01");
    return json({ enabled: true, thread: { status: thread.status }, unread: count ?? 0 });
  }

  const afterId = Math.max(0, Math.floor(Number(url.searchParams.get("after")) || 0));
  const { data } = await admin
    .from("support_messages")
    .select(MSG_COLS)
    .eq("thread_id", thread.id)
    .gt("id", afterId)
    .order("id")
    .limit(200);
  if (url.searchParams.get("open")) await admin.from("support_threads").update({ user_seen_at: new Date().toISOString() }).eq("id", thread.id);
  const res = json({
    enabled: true,
    viewer,
    needLogin: false,
    thread: { status: thread.status, email: thread.email },
    messages: (data ?? []) as SupportMessage[],
    unread: 0,
  });
  if (thread.token !== cookie) res.cookies.set(supportCookie(thread.token, url.protocol === "https:"));
  return res;
}

/** Skriv en besked: { body, email?, page?, website? }. Uden login skal der en e-mail med første gang. */
export async function POST(req: Request) {
  const { admin, user, thread, cookie } = await context();
  if (!admin) return fail("Chatten er ikke sat op endnu. Skriv til kontakt@relived.dk.", 503);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Feltet "website" er skjult, så kun robotter udfylder det.
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true, message: null });
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return fail("Skriv en besked.", 400);
  if (text.length > SUPPORT_MAX) return fail(`Beskeden er for lang (højst ${SUPPORT_MAX} tegn).`, 400);
  const page = cleanPage(body.page);
  const secure = new URL(req.url).protocol === "https:";

  if (thread) {
    const { data, error } = await admin.rpc("support_add", {
      p_thread: thread.id,
      p_sender: "user",
      p_author: user && thread.user_id === user.id ? user.id : null,
      p_author_name: null,
      p_body: text,
    });
    if (error) return failFrom(error.message);
    const r = data as { message: SupportMessage; notify: boolean };
    if (r.notify) after(() => mailAdminsAboutSupport({ ...thread, page: page ?? thread.page }, text, false));
    const res = json({ message: r.message, thread: { status: "open", email: thread.email } });
    if (thread.token !== cookie) res.cookies.set(supportCookie(thread.token, secure));
    return res;
  }

  let email: string | null;
  let name: string | null = null;
  if (user) {
    email = user.email?.toLowerCase() ?? null;
    const { data: p } = await admin.from("profiles").select("handle,display_name").eq("id", user.id).maybeSingle<{ handle: string; display_name: string | null }>();
    name = p ? p.display_name?.trim() || `@${p.handle}` : null;
  } else {
    email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
    if (!EMAIL.test(email)) return fail("Skriv din e-mail, så vi kan svare dig.", 400);
  }
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300) || null;
  const { data, error } = await admin.rpc("support_start", {
    p_user: user?.id ?? null,
    p_email: email,
    p_name: name,
    p_page: page,
    p_ua: ua,
    p_ip_hash: ipHash(req),
    p_body: text,
  });
  if (error) return failFrom(error.message);
  const r = data as { thread_id: string; token: string; message: SupportMessage; notify: boolean };
  after(() => mailAdminsAboutSupport({ id: r.thread_id, email, name, page, user_agent: ua }, text, true));
  const res = json({ message: r.message, thread: { status: "open", email } });
  res.cookies.set(supportCookie(r.token, secure));
  return res;
}

function failFrom(msg: string) {
  if (known.test(msg)) return fail(msg, /mange|travlt/.test(msg) ? 429 : 400);
  console.error("[snuplive] support", msg);
  return fail("Beskeden blev ikke sendt. Prøv igen, eller skriv til kontakt@relived.dk.", 500);
}
