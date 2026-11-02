import { SITE_URL } from "@/lib/env";
import { kr } from "@/lib/format";
import { itemHref } from "@/lib/items";
import { sendMail } from "@/lib/mail";
import { sendPush } from "@/lib/push";
import { OFFER_HOURS, RESERVATION_DAYS } from "@/lib/pricing";
import type { createAdminClient } from "@/lib/supabase/admin";

// Bud på varer til fast pris (0028_bud_paa_varer.sql). Beskeder til sælgeren om nye bud og til køberen om svaret.
// Har modtageren slået besked på telefonen til, kommer den der, ellers på mail.

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export interface Offer {
  id: string;
  item_id: string;
  user_id: string;
  seller_id: string;
  amount: number;
  price: number;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "expired" | "closed";
  created_at: string;
  expires_at: string;
}

async function context(admin: Admin, o: Offer) {
  const [item, buyer, seller] = await Promise.all([
    admin.from("items").select("id,name").eq("id", o.item_id).maybeSingle(),
    admin.from("profiles").select("handle").eq("id", o.user_id).maybeSingle(),
    admin.from("profiles").select("handle").eq("id", o.seller_id).maybeSingle(),
  ]);
  return {
    name: (item.data?.name as string | undefined) ?? "din vare",
    href: item.data ? itemHref(item.data as { id: string; name: string }) : "/",
    buyer: (buyer.data?.handle as string | undefined) ?? "en køber",
    seller: (seller.data?.handle as string | undefined) ?? "sælgeren",
  };
}

async function emailOf(admin: Admin, uid: string) {
  const { data } = await admin.auth.admin.getUserById(uid).catch(() => ({ data: null }));
  return data?.user?.email ?? null;
}

async function tell(admin: Admin, uid: string, push: { title: string; body: string; url: string; tag: string }, mail: { subject: string; text: string[] }) {
  const delivered = await sendPush(admin, [uid], push, OFFER_HOURS * 3600);
  if (delivered.has(uid)) return;
  const to = await emailOf(admin, uid);
  if (to) await sendMail({ to: [to], subject: mail.subject.slice(0, 140), text: [...mail.text, "", "Venlig hilsen", "Relived"].join("\n") });
}

/** Sælgeren får besked om et nyt bud. */
export async function notifyNewOffer(admin: Admin, o: Offer) {
  const c = await context(admin, o);
  await tell(
    admin,
    o.seller_id,
    {
      title: `Nyt bud på ${c.name}`,
      body: `@${c.buyer} byder ${kr(o.amount)} (din pris er ${kr(o.price)}). Svar inden ${OFFER_HOURS} timer.`,
      url: "/studio#bud",
      tag: `bud-${o.id}`,
    },
    {
      subject: `Nyt bud på ${c.name}: ${kr(o.amount)}`,
      text: [
        "Hej",
        "",
        `@${c.buyer} byder ${kr(o.amount)} på ${c.name}, som du har til salg til ${kr(o.price)}.`,
        `Siger du ja, bliver varen reserveret til køberen, som så betaler inden ${RESERVATION_DAYS} dage. Buddet gælder i ${OFFER_HOURS} timer.`,
        "",
        "Svar under Mine shows:",
        `${SITE_URL}/studio#bud`,
      ],
    },
  );
}

/** Køberen får besked om sælgerens svar. */
export async function notifyOfferAnswer(admin: Admin, o: Offer) {
  const c = await context(admin, o);
  if (o.status === "accepted") {
    await tell(
      admin,
      o.user_id,
      {
        title: "Dit bud er accepteret",
        body: `${c.name} er din for ${kr(o.amount)}. Betal under Mine køb inden ${RESERVATION_DAYS} dage.`,
        url: "/kurv",
        tag: `bud-${o.id}`,
      },
      {
        subject: `Dit bud på ${c.name} er accepteret`,
        text: [
          "Hej",
          "",
          `@${c.seller} har sagt ja til dit bud på ${kr(o.amount)} for ${c.name}.`,
          `Varen er reserveret til dig. Betal under Mine køb inden ${RESERVATION_DAYS} dage, ellers bliver købet annulleret:`,
          `${SITE_URL}/kurv`,
        ],
      },
    );
  } else if (o.status === "declined") {
    await tell(
      admin,
      o.user_id,
      {
        title: "Dit bud blev ikke accepteret",
        body: `@${c.seller} sagde nej til ${kr(o.amount)} for ${c.name}. Du kan stadig købe den til ${kr(o.price)}.`,
        url: c.href,
        tag: `bud-${o.id}`,
      },
      {
        subject: `Svar på dit bud på ${c.name}`,
        text: [
          "Hej",
          "",
          `@${c.seller} har sagt nej til dit bud på ${kr(o.amount)} for ${c.name}.`,
          `Varen er stadig til salg til ${kr(o.price)}, så længe ingen andre køber den:`,
          `${SITE_URL}${c.href}`,
        ],
      },
    );
  }
}
