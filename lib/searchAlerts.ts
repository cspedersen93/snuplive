import { SITE_URL } from "@/lib/env";
import { kr, sizeText, vareOrd, when } from "@/lib/format";
import { itemHref } from "@/lib/items";
import { sendMailBatch } from "@/lib/mail";
import { sendPush } from "@/lib/push";
import { searchHref, searchLabel } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Hit = {
  user_id: string;
  email: string | null;
  search_id: string;
  query: string;
  category: string | null;
  item_id: string;
  item_name: string;
  price: number;
  size: string | null;
  kind: "for_sale" | "live" | "upcoming";
  starts_at: string | null;
  handle: string;
};

const whereText = (h: Hit) =>
  h.kind === "live" ? `live nu hos @${h.handle}` : h.kind === "upcoming" ? `vises ${when(h.starts_at).replace(/^./, (c) => c.toLowerCase())} hos @${h.handle}` : `til salg hos @${h.handle}`;

const line = (h: Hit) => [h.item_name, kr(h.price), sizeText(h.size)?.replace(/^Str\./, "str.") ?? ""].filter(Boolean).join(" · ");

/** Hvor beskeden fører hen: live-showet, hvis varen er live nu, ellers varens side. */
const hitPath = (h: Hit) => (h.kind === "live" ? `/live/${h.handle}` : itemHref({ id: h.item_id, name: h.item_name }));

/**
 * Søgeagenterne: finder nye varer, der passer til de gemte søgninger (claim_search_alerts i databasen), og giver besked.
 * Har køberen slået besked på telefonen til, kommer den der, ellers på mail. Én besked pr. køber pr. gang.
 * Giver antallet af købere, der fik besked. Uden 0024_soegning.sql sker der ingenting.
 */
export async function sendSearchAlerts(admin: Admin): Promise<number> {
  const { data, error } = await admin.rpc("claim_search_alerts");
  if (error || !data?.length) return 0;
  const byUser = new Map<string, { email: string | null; hits: Hit[] }>();
  for (const h of data as Hit[]) {
    const u = byUser.get(h.user_id) ?? { email: h.email, hits: [] };
    // Samme vare kan passe til flere søgninger. Den kommer kun med én gang.
    if (!u.hits.some((x) => x.item_id === h.item_id)) u.hits.push(h);
    byUser.set(h.user_id, u);
  }

  const notPushed: { to: string; subject: string; text: string }[] = [];
  for (const [uid, { email, hits }] of byUser) {
    const one = hits.length === 1 ? hits[0] : null;
    const label = searchLabel(hits[0]);
    const delivered = await sendPush(
      admin,
      [uid],
      one
        ? { title: one.kind === "live" ? "Det, du søger, er live nu" : "Ny vare til din søgning", body: `${line(one)} · ${whereText(one)}`, url: hitPath(one), tag: `soeg-${one.item_id}` }
        : {
            title: `${hits.length} nye ${vareOrd(hits.length)} til dine søgninger`,
            body: hits.slice(0, 3).map((h) => h.item_name).join(", "),
            url: searchHref({ q: hits[0].query, category: hits[0].category, maxPrice: null, size: null }),
            tag: `soeg-${hits[0].search_id}`,
          },
      24 * 3600,
    );
    if (delivered.has(uid) || !email) continue;
    notPushed.push({
      to: email,
      subject: one ? `Nyt til din søgning ${label}: ${one.item_name}`.slice(0, 120) : `${hits.length} nye ${vareOrd(hits.length)} til dine søgeagenter`,
      text: [
        "Hej",
        "",
        one ? "Der er kommet en vare, der passer til din søgning:" : "Der er kommet varer, der passer til dine søgninger:",
        "",
        ...hits.flatMap((h) => [`${line(h)} (${whereText(h)})`, `${SITE_URL}${hitPath(h)}`, ""]),
        "Du får beskeden, fordi du har gemt en søgning på Relived. Du kan slette dine søgeagenter under Min konto:",
        `${SITE_URL}/konto#soegeagenter`,
        "",
        "Venlig hilsen",
        "Relived",
      ].join("\n"),
    });
  }
  if (notPushed.length) await sendMailBatch(notPushed);
  return byUser.size;
}

let lastSweep = 0;

/**
 * Kører søgeagenterne, højst hvert `gapMs` pr. server: hvert 3. minut efter sidevisninger (se lib/queries.ts) og
 * hvert 15. sekund, når en sælger har lagt noget op (/api/search-alerts). Når et show går live, køres de altid (0).
 * Det daglige job kører dem også. Hver vare giver kun besked én gang, så det gør ikke noget at køre dem ofte.
 */
export async function sweepSearchAlerts(gapMs = 3 * 60_000) {
  if (Date.now() - lastSweep < gapMs) return 0;
  lastSweep = Date.now();
  const admin = createAdminClient();
  if (!admin) return 0;
  try {
    return await sendSearchAlerts(admin);
  } catch (e) {
    console.error("[relived] søgeagenter:", e instanceof Error ? e.message : e);
    return 0;
  }
}
