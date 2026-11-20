import { CARRIERS, isCarrier } from "@/lib/carriers";
import { SITE_URL } from "@/lib/env";
import { kr, vareOrd } from "@/lib/format";
import { adminEmails, sendMail } from "@/lib/mail";
import { RESERVATION_DAYS } from "@/lib/pricing";
import type { AdminClient } from "@/lib/supabase/admin";

/**
 * Mails om ordrer: betalt (til sælger og køber), vundet budsalg, og når en sag er afgjort.
 * Ingen af dem må vælte det, de fortæller om: betalingen og afgørelsen er sket, uanset om mailen kom afsted.
 * Derfor fanger hver funktion sine egne fejl.
 */

const SIGN = ["", "Venlig hilsen", "Relived"];

async function emailOf(admin: AdminClient, uid: string) {
  const { data } = await admin.auth.admin.getUserById(uid).catch(() => ({ data: null }));
  return data?.user?.email ?? null;
}

interface OrderInfo {
  id: string;
  buyer_id: string;
  seller_id: string;
  delivery: "ship" | "pickup";
  items_amount: number;
  shipping_amount: number;
  fee_amount: number;
  total_amount: number;
  sp_carrier: string | null;
  sp_name: string | null;
  sp_address: string | null;
  sp_zipcode: string | null;
  sp_city: string | null;
  buyer: { handle: string } | null;
  seller: { handle: string; seller_type: string | null; business_name: string | null; business_cvr: string | null } | null;
  sales: { price: number; item: { name: string } | null }[];
}

const ORDER_INFO =
  "id,buyer_id,seller_id,delivery,items_amount,shipping_amount,fee_amount,total_amount,sp_carrier,sp_name,sp_address,sp_zipcode,sp_city," +
  "buyer:profiles!orders_buyer_id_fkey(handle),seller:profiles!orders_seller_id_fkey(handle,seller_type,business_name,business_cvr)," +
  "sales!sales_order_id_fkey(price,item:items(name))";

async function fetchOrders(admin: AdminClient, ids: string[]) {
  const { data, error } = await admin.from("orders").select(ORDER_INFO).in("id", ids);
  if (error) throw error;
  return (data ?? []) as unknown as OrderInfo[];
}

/** "- Sommerkjole, blå: 200 kr", og samlerabatten på sin egen linje, hvis der er en. */
function itemLines(o: OrderInfo) {
  const lines = o.sales.map((s) => `- ${s.item?.name ?? "Vare"}: ${kr(s.price)}`);
  const full = o.sales.reduce((a, s) => a + s.price, 0);
  if (full > o.items_amount) lines.push(`- Samlerabat: −${kr(full - o.items_amount)}`);
  return lines;
}

/** "DAO-pakkeshoppen Kvickly Hvidovre, Hvidovrevej 300, 2650 Hvidovre", eller null uden pakkeshop. */
function shopText(o: OrderInfo) {
  if (!o.sp_name) return null;
  const carrier = isCarrier(o.sp_carrier) ? `${CARRIERS[o.sp_carrier].name}-pakkeshoppen` : "pakkeshoppen";
  return `${carrier} ${[o.sp_name, o.sp_address, [o.sp_zipcode, o.sp_city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}`;
}

const at = (handle: string | undefined, fallback: string) => (handle ? `@${handle}` : fallback);

/**
 * Ordrerne i en betaling er netop blevet betalt: sælgeren får besked om at sende, og køberen får sin
 * ordrebekræftelse. Kaldes kun for de ordrer, der skiftede til betalt, så mailene sendes én gang.
 */
export async function mailOrdersPaid(admin: AdminClient, orderIds: string[]) {
  try {
    const orders = await fetchOrders(admin, orderIds);
    if (!orders.length) return;

    for (const o of orders) {
      const to = await emailOf(admin, o.seller_id);
      if (!to) continue;
      const n = o.sales.length;
      const shop = shopText(o);
      const { data: acct } = await admin.from("payout_accounts").select("payouts_enabled").eq("user_id", o.seller_id).maybeSingle();
      await sendMail({
        to: [to],
        subject: `Betalt: ${n} ${vareOrd(n)} til ${at(o.buyer?.handle, "en køber")} skal ${o.delivery === "pickup" ? "afhentes" : "sendes"}`,
        text: [
          "Hej",
          "",
          `${at(o.buyer?.handle, "En køber")} har betalt for ${n} ${vareOrd(n)} fra dig:`,
          "",
          ...itemLines(o),
          "",
          ...(o.delivery === "pickup"
            ? ["Køberen henter selv. Aftal tid og sted med køberen. Telefonnummeret står på ordren i dit studie:"]
            : shop
              ? [`Pakken skal til ${shop}.`, "Lav fragtlabelen i dit studie, og send pakken inden 3 hverdage:"]
              : ["Køberens adresse står på ordren i dit studie. Send pakken inden 3 hverdage:"]),
          `${SITE_URL}/studio`,
          "",
          "Pengene bliver sendt til din bankkonto, når køberen har fået varerne.",
          ...(acct?.payouts_enabled ? [] : ["Du mangler at tilknytte din bankkonto. Gør det i dit studie, så vi kan sende pengene til dig."]),
          ...SIGN,
        ].join("\n"),
      });
    }

    const buyerMail = await emailOf(admin, orders[0].buyer_id);
    if (!buyerMail) return;
    const blocks: string[] = [];
    for (const o of orders) {
      const s = o.seller;
      const who =
        s?.seller_type === "business"
          ? `virksomhed${s.business_name ? `: ${s.business_name}` : ""}${s.business_cvr ? `, CVR ${s.business_cvr}` : ""}`
          : "privat sælger";
      const shop = shopText(o);
      blocks.push(
        `Fra ${at(s?.handle, "sælgeren")} (${who}):`,
        ...itemLines(o),
        o.delivery === "pickup" ? "- Afhentning hos sælgeren: 0 kr" : `- Fragt til pakkeshop: ${kr(o.shipping_amount)}`,
        `- Køberbeskyttelse: ${kr(o.fee_amount)}`,
        ...(orders.length > 1 ? [`I alt hos ${at(s?.handle, "sælgeren")}: ${kr(o.total_amount)}`] : []),
        "",
        o.delivery === "pickup"
          ? `Du henter selv varerne hos ${at(s?.handle, "sælgeren")}. Sælgeren har fået dit telefonnummer, så I kan aftale tid og sted.`
          : shop
            ? `Sælgeren sender pakken til ${shop}. Fragtfirmaet giver dig besked, når den er klar.`
            : "Sælgeren sender pakken til dig.",
        s?.seller_type === "business"
          ? "Sælgeren er en virksomhed, så du har 14 dages fortrydelsesret fra den dag, du har fået varen."
          : "Sælgeren er en privatperson, så der er ikke fortrydelsesret.",
        "",
      );
    }
    const total = orders.reduce((a, o) => a + o.total_amount, 0);
    await sendMail({
      to: [buyerMail],
      subject: "Tak for dit køb på Relived",
      text: [
        "Hej",
        "",
        "Tak for dit køb. Her er din ordrebekræftelse.",
        "",
        ...blocks,
        `Betalt i alt: ${kr(total)}`,
        "",
        "Pengene holdes tilbage hos Relived, til du har fået dine varer. Er noget galt, så tryk Meld et problem på ordren under Mine køb, før den er afsluttet.",
        `Følg dine køb her: ${SITE_URL}/kurv`,
        "",
        "Du har købt af sælgeren og ikke af Relived. Handelsbetingelserne finder du her:",
        `${SITE_URL}/handelsbetingelser`,
        ...SIGN,
      ].join("\n"),
    });
  } catch (e) {
    console.error("[relived] mail om betalt ordre blev ikke sendt", orderIds, e);
  }
}

/**
 * Vinderen af et budsalg får en mail om at betale. Kolonnen sales.won_mail_at (0040) husker, at mailen er sendt,
 * så den kun sendes én gang, uanset om det er studiet, en seer eller det daglige job, der spørger.
 * Uden 0040 sker der ingenting.
 */
export async function mailAuctionWins(admin: AdminClient, itemId?: string) {
  try {
    const since = new Date(Date.now() - RESERVATION_DAYS * 864e5).toISOString();
    let q = admin
      .from("sales")
      .select("id,price,buyer_id,item:items!inner(name,sale_type),seller:profiles!sales_seller_id_fkey(handle)")
      .eq("status", "reserved")
      .is("won_mail_at", null)
      .eq("item.sale_type", "auction")
      .gte("created_at", since)
      .limit(50);
    if (itemId) q = q.eq("item_id", itemId);
    const { data, error } = await q;
    if (error) return 0; // 0040 er ikke kørt endnu
    let sent = 0;
    for (const s of (data ?? []) as unknown as { id: string; price: number; buyer_id: string; item: { name: string } | null; seller: { handle: string } | null }[]) {
      // Kun den, der når at sætte tidsstemplet, sender mailen.
      const { data: mine } = await admin.from("sales").update({ won_mail_at: new Date().toISOString() }).eq("id", s.id).is("won_mail_at", null).select("id");
      if (!mine?.length) continue;
      const to = await emailOf(admin, s.buyer_id);
      if (!to) continue;
      const name = s.item?.name ?? "varen";
      await sendMail({
        to: [to],
        subject: `Du vandt budsalget: ${name} for ${kr(s.price)}`.slice(0, 140),
        text: [
          "Hej",
          "",
          `Du vandt budsalget på ${name} hos ${at(s.seller?.handle, "sælgeren")} med dit bud på ${kr(s.price)}.`,
          "",
          `Varen ligger under Mine køb. Betal inden ${RESERVATION_DAYS} dage, så sælgeren kan sende den:`,
          `${SITE_URL}/kurv`,
          "",
          "Fragt og køberbeskyttelse kommer oveni. Du ser den samlede pris, før du betaler.",
          "Betaler du ikke inden fristen, bliver købet annulleret, og sælgeren kan sælge varen igen.",
          ...SIGN,
        ].join("\n"),
      });
      sent++;
    }
    return sent;
  } catch (e) {
    console.error("[relived] mail om vundet budsalg blev ikke sendt", itemId, e);
    return 0;
  }
}

export type IssueOutcome = "refund" | "release" | "close" | "cover" | "seller_refund";

/**
 * En sag er afgjort (eller sælgeren har selv givet pengene tilbage): køber og sælger får besked.
 * Kaldes, efter pengene er flyttet, og kun når handlingen lykkedes.
 */
export async function mailIssueDecided(admin: AdminClient, orderId: string, outcome: IssueOutcome) {
  try {
    const [o] = await fetchOrders(admin, [orderId]);
    if (!o) return;
    const { data: issue } = await admin.from("order_issues").select("reason").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const { data: ret } = await admin.from("order_returns").select("sent_at").eq("order_id", orderId).maybeSingle();
    // En admin kan også refundere eller afslutte en ordre uden sag. Så er der ingen afgørelse at fortælle om:
    // kun en refusion får en mail, og den siger bare, at pengene er på vej tilbage.
    if (!issue && outcome !== "seller_refund") {
      if (outcome !== "refund") return;
      outcome = "seller_refund";
    }
    const admins = adminEmails();
    const seller = at(o.seller?.handle, "sælgeren");
    const buyer = at(o.buyer?.handle, "køberen");
    const bank = "Pengene går tilbage til det kort eller den konto, du betalte med. Der kan gå nogle bankdage, før de står på din konto.";
    const ask = "Har du spørgsmål, kan du svare på den her mail.";

    const toBuyer: { subject: string; text: string[] } | null =
      outcome === "refund"
        ? {
            subject: "Din sag er afgjort: du får pengene tilbage",
            text: [`Vi har afgjort din sag om ordren fra ${seller} og givet dig medhold. Du får ${kr(o.total_amount)} tilbage.`, "", bank],
          }
        : outcome === "cover"
          ? {
              subject: "Din sag er afgjort: du får pengene tilbage",
              text: [
                `Vi har afgjort din sag om ordren fra ${seller}. Du får ${kr(o.total_amount)} tilbage, og du skal ikke sende noget retur.`,
                ...(issue?.reason === "damaged" ? ["Gem varen og emballagen lidt endnu. Fragtfirmaet kan bede om at se den."] : []),
                "",
                bank,
              ],
            }
          : outcome === "release"
            ? {
                subject: "Din sag er afgjort",
                text: [
                  `Vi har gennemgået din sag om ordren fra ${seller} sammen med det, sælgeren viste i showet.`,
                  "Vi har ikke kunnet give dig medhold, så ordren er afsluttet, og pengene er sendt til sælgeren.",
                ],
              }
            : outcome === "close"
              ? {
                  subject: "Din sag er lukket",
                  text: [`Vi har lukket din sag om ordren fra ${seller} uden at flytte penge. Ordren fortsætter som normalt, og du kan se den under Mine køb:`, `${SITE_URL}/kurv`],
                }
              : {
                  subject: "Du har fået pengene tilbage",
                  text: [`Du har fået pengene tilbage for din ordre fra ${seller}: ${kr(o.total_amount)}.`, "", bank],
                };

    const toSeller: { subject: string; text: string[] } | null =
      outcome === "refund"
        ? {
            subject: "Sagen er afgjort: køberen har fået pengene tilbage",
            text: [
              `Vi har afgjort sagen om ordren til ${buyer} og givet køberen medhold. Køberen har fået pengene tilbage, så der kommer ingen udbetaling for ordren.`,
              ret?.sent_at ? "Køberen har sendt varen retur til dig." : "",
              "Varerne står ikke længere som solgt, så du kan sætte dem til salg igen.",
            ].filter(Boolean),
          }
        : outcome === "cover"
          ? {
              subject: "Sagen er afgjort: du får din udbetaling",
              text: [`Vi har afgjort sagen om ordren til ${buyer}. Relived har dækket købet, så du får din udbetaling for ordren som normalt.`],
            }
          : outcome === "release"
            ? {
                subject: "Sagen er afgjort: du får din udbetaling",
                text: [`Vi har afgjort sagen om ordren til ${buyer} og givet dig medhold. Pengene for ordren bliver sendt til din bankkonto.`],
              }
            : outcome === "close"
              ? {
                  subject: "Sagen om din ordre er lukket",
                  text: [`Vi har lukket sagen om ordren til ${buyer} uden at flytte penge. Ordren fortsætter som normalt, og du kan se den i dit studie:`, `${SITE_URL}/studio`],
                }
              : null;

    const buyerMail = await emailOf(admin, o.buyer_id);
    if (buyerMail && toBuyer) {
      await sendMail({ to: [buyerMail], replyTo: admins, subject: toBuyer.subject, text: ["Hej", "", ...toBuyer.text, "", ask, ...SIGN].join("\n") });
    }
    const sellerMail = toSeller ? await emailOf(admin, o.seller_id) : null;
    if (sellerMail && toSeller) {
      await sendMail({ to: [sellerMail], replyTo: admins, subject: toSeller.subject, text: ["Hej", "", ...toSeller.text, "", ask, ...SIGN].join("\n") });
    }
  } catch (e) {
    console.error("[relived] mail om afgjort sag blev ikke sendt", orderId, outcome, e);
  }
}
