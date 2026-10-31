import { SITE_URL } from "@/lib/env";
import { vareOrd, when } from "@/lib/format";
import { sendMailBatch } from "@/lib/mail";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Row = { user_id: string; email: string; show_id: string; title: string; starts_at: string; handle: string; item_count: number };

/**
 * Morgenmailen (det daglige job): én mail til hver følger med de shows, der starter inden for et døgn hos de
 * sælgere, de følger. Hvert show kommer kun med én gang. Giver antallet af sendte mails.
 */
export async function sendFollowDigest(admin: Admin) {
  const { data, error } = await admin.rpc("follow_digest");
  if (error) return 0; // 0016_foelg.sql er ikke kørt endnu
  const byUser = new Map<string, { email: string; shows: Row[] }>();
  for (const r of (data ?? []) as Row[]) {
    if (!r.email) continue;
    const u = byUser.get(r.user_id) ?? { email: r.email, shows: [] };
    u.shows.push(r);
    byUser.set(r.user_id, u);
  }
  const mails = [...byUser.values()].map(({ email, shows }) => {
    const one = shows.length === 1 ? shows[0] : null;
    const subject = one
      ? `${when(one.starts_at)}: @${one.handle} går live med ${one.title}`
      : `${shows.length} sælgere, du følger, går live snart`;
    const lines = shows.flatMap((s) => [
      `${when(s.starts_at)} · @${s.handle} · ${s.title}${s.item_count ? ` (${s.item_count} ${vareOrd(s.item_count)})` : ""}`,
      `${SITE_URL}/live/${s.handle}`,
      "",
    ]);
    return {
      to: email,
      subject,
      text: [
        "Hej",
        "",
        one ? "En sælger, du følger, går snart live:" : "Sælgere, du følger, går snart live:",
        "",
        ...lines,
        "Vi giver dig besked igen, når showet starter.",
        "",
        "Du får denne mail, fordi du følger sælgerne på Relived. Vil du ikke have flere, så tryk Følger på deres side.",
      ].join("\n"),
    };
  });
  return sendMailBatch(mails);
}
