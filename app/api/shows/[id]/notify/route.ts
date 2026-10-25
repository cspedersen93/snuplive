import { fail, json } from "@/lib/api";
import { SITE_URL } from "@/lib/env";
import { sendMailBatch } from "@/lib/mail";
import { sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Sælgeren er gået live: besked til alle, der har trykket "Husk mig", til sælgerens følgere og til følgerne af gæsterne i showet.
 * Har man slået besked på telefonen til, får man den der. Ellers en mail. Sker kun én gang pr. show.
 */
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
  if (!show) return json({ sent: 0, pushed: 0 });
  const { data: prof } = await admin.from("profiles").select("handle").eq("id", show.seller_id).maybeSingle();
  const handle = (prof?.handle as string | undefined) ?? "saelger";
  const path = `/live/${handle}`;
  const link = `${SITE_URL}${path}`;

  type Person = { email: string; items: string[]; reminded: boolean; follower: boolean; viaGuest?: string };
  const people = new Map<string, Person>();
  const { data: rem } = await admin.rpc("reminder_recipients", { p_show: id });
  for (const r of (rem ?? []) as { user_id: string; email: string; items: string[] }[]) {
    people.set(r.user_id, { email: r.email, items: r.items ?? [], reminded: true, follower: false });
  }

  // Følgerne. Går sælgeren live flere gange på kort tid, får følgerne kun besked første gang (inden for 2 timer).
  const since = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data: recent } = await admin.from("shows").select("id").eq("seller_id", show.seller_id).neq("id", show.id).gt("notified_at", since).limit(1);
  if (!recent?.length) {
    const { data: fol, error } = await admin.rpc("follower_recipients", { p_seller: show.seller_id });
    if (!error) {
      for (const f of (fol ?? []) as { user_id: string; email: string }[]) {
        const p = people.get(f.user_id);
        if (p) p.follower = true;
        else people.set(f.user_id, { email: f.email, items: [], reminded: false, follower: true });
      }
    }
  }
  // Gæsterne i showet (0020_gaester.sql): deres følgere får også besked ("@lise er med i @maja's show").
  const { data: guestRows } = await admin.rpc("show_guest_ids", { p_show: show.id });
  const guestIds = ((guestRows ?? []) as unknown[]).map((g) => (typeof g === "string" ? g : (g as { show_guest_ids?: string }).show_guest_ids)).filter(
    (g): g is string => typeof g === "string",
  );
  if (guestIds.length) {
    const { data: gp } = await admin.from("profiles").select("id,handle").in("id", guestIds);
    for (const g of (gp ?? []) as { id: string; handle: string }[]) {
      const { data: fol, error } = await admin.rpc("follower_recipients", { p_seller: g.id });
      if (error) continue;
      for (const f of (fol ?? []) as { user_id: string; email: string }[]) {
        if (!people.has(f.user_id)) people.set(f.user_id, { email: f.email, items: [], reminded: false, follower: true, viaGuest: g.handle });
      }
    }
    for (const g of guestIds) people.delete(g);
  }
  people.delete(show.seller_id);
  if (!people.size) return json({ sent: 0, pushed: 0 });

  const direct = [...people.entries()].filter(([, p]) => !p.viaGuest).map(([u]) => u);
  const pushed = await sendPush(admin, direct, {
    title: `@${handle} er live nu`,
    body: show.title,
    url: path,
    tag: `live-${show.id}`,
  });
  // Følgere af en gæst: én besked pr. gæst.
  const byGuest = new Map<string, string[]>();
  for (const [u, p] of people) if (p.viaGuest) byGuest.set(p.viaGuest, [...(byGuest.get(p.viaGuest) ?? []), u]);
  for (const [g, users] of byGuest) {
    const got = await sendPush(admin, users, {
      title: `@${g} er live hos @${handle}`,
      body: show.title,
      url: path,
      tag: `live-${show.id}`,
    });
    got.forEach((u) => pushed.add(u));
  }

  const mails = [...people.entries()]
    .filter(([userId, p]) => !pushed.has(userId) && p.email)
    .map(([, p]) => ({
      to: p.email,
      subject: p.viaGuest ? `@${p.viaGuest} er live hos @${handle}: ${show.title}` : `@${handle} er live nu: ${show.title}`,
      text: [
        "Hej",
        "",
        p.viaGuest
          ? `@${p.viaGuest} er med som gæst i @${handle}s show "${show.title}", som er live nu.`
          : `@${handle} er gået live med showet "${show.title}".`,
        p.items.length ? `Du bad os huske dig på: ${p.items.join(", ")}.` : "",
        "",
        `Se med og køb: ${link}`,
        "",
        p.viaGuest
          ? `Du får denne mail, fordi du følger @${p.viaGuest} på Relived. Vil du ikke have flere, så tryk Følger på ${SITE_URL}/live/${p.viaGuest}.`
          : p.follower
            ? `Du får denne mail, fordi du følger @${handle} på Relived. Vil du ikke have flere, så tryk Følger på ${link}.`
            : "Du får denne mail, fordi du trykkede Husk mig på Relived.",
      ]
        .filter((l, i, a) => l !== "" || a[i - 1] !== "")
        .join("\n"),
    }));
  const sent = await sendMailBatch(mails);
  return json({ sent, pushed: pushed.size });
}
