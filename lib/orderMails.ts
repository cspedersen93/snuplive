import { CARRIERS, isCarrier } from "@/lib/carriers";
import { SITE_URL } from "@/lib/env";
import { clock, dayLabel, kr, vareOrd } from "@/lib/format";
import { adminEmails, sendMail } from "@/lib/mail";
import { pickupReady } from "@/lib/pickup";
import { RESERVATION_DAYS, sellerPayout } from "@/lib/pricing";
import type { AdminClient } from "@/lib/supabase/admin";

/**
 * Mails om ordrer: betalt (til sælger og køber), vundet budsalg, afhentning, der ikke er bekræftet, og når en sag er afgjort.
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
    // Afhentning: med 0041_afhentning.sql bekræfter køber og sælger begge. Uden filen bekræfter køberen alene.
    const both = orders.some((o) => o.delivery === "pickup") && (await pickupReady(admin).catch(() => false));

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
          o.delivery === "pickup" && both
            ? "Når køberen står med varerne, bekræfter I begge afhentningen på jeres telefoner, før I går hver til sit. Først derefter bliver pengene sendt til din bankkonto."
            : "Pengene bliver sendt til din bankkonto, når køberen har fået varerne.",
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
          ? `Du henter selv varerne hos ${at(s?.handle, "sælgeren")}. Sælgeren har fået dit telefonnummer, så I kan aftale tid og sted.${
              both ? " Når du står med varerne, bekræfter I begge afhentningen på jeres telefoner, før I går hver til sit. Først derefter får sælgeren pengene." : ""
            }`
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

const stamp = (iso: string | null) => (iso ? `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}` : "");

/**
 * Afhentningen er ikke bekræftet af både køber og sælger (0041_afhentning.sql): den eller de, der mangler, får en
 * påmindelse. `done` fortæller, hvem der allerede har bekræftet.
 */
export async function mailPickupReminder(admin: AdminClient, orderId: string, done: { buyer: boolean; seller: boolean }) {
  try {
    const [o] = await fetchOrders(admin, [orderId]);
    if (!o) return;
    const n = o.sales.length;
    const it = n === 1 ? "varen" : "varerne";
    const seller = at(o.seller?.handle, "sælgeren");
    const buyer = at(o.buyer?.handle, "køberen");
    if (!done.buyer) {
      const to = await emailOf(admin, o.buyer_id);
      if (to) {
        await sendMail({
          to: [to],
          subject: done.seller ? `Bekræft, at du har hentet ${n === 1 ? "din vare" : "dine varer"} hos ${seller}` : `Har du hentet ${n === 1 ? "din vare" : "dine varer"} hos ${seller}?`,
          text: [
            "Hej",
            "",
            done.seller
              ? `${seller} har bekræftet, at du har hentet ${it}:`
              : `Du har betalt for ${n} ${vareOrd(n)} hos ${seller}, som du selv henter:`,
            "",
            ...itemLines(o),
            "",
            done.seller
              ? `Har du fået ${it}, så bekræft det også selv. Handlen afsluttes først, når I begge har bekræftet, og så får sælgeren pengene.`
              : `Afhentningen er ikke bekræftet endnu. Når du står med ${it} hos sælgeren, bekræfter I begge på jeres telefoner, før I går hver til sit. Først derefter får sælgeren pengene.`,
            "Du bekræfter på ordren under Mine køb:",
            `${SITE_URL}/kurv`,
            "",
            done.seller
              ? `Har du ikke fået ${it}, eller er noget galt, så tryk Meld et problem på ordren.`
              : "Har I ikke fået aftalt tid og sted, eller er noget galt, så tryk Meld et problem på ordren.",
            ...SIGN,
          ].join("\n"),
        });
      }
    }
    if (!done.seller) {
      const to = await emailOf(admin, o.seller_id);
      if (to) {
        await sendMail({
          to: [to],
          subject: done.buyer ? `${buyer} har bekræftet afhentningen. Nu mangler du` : `Afhentningen til ${buyer} er ikke bekræftet`,
          text: [
            "Hej",
            "",
            done.buyer
              ? `${buyer} har bekræftet, at ${it} er hentet hos dig:`
              : `${buyer} har betalt for ${n} ${vareOrd(n)}, som skal hentes hos dig:`,
            "",
            ...itemLines(o),
            "",
            done.buyer
              ? "Nu mangler kun din bekræftelse. Handlen afsluttes først, når I begge har bekræftet, og så bliver pengene sendt til din bankkonto."
              : `Afhentningen er ikke bekræftet endnu. Når køberen står med ${it}, bekræfter I begge på jeres telefoner, før I går hver til sit. Først derefter bliver pengene sendt til din bankkonto.`,
            "Du bekræfter på ordren i dit studie:",
            `${SITE_URL}/studio`,
            ...(done.buyer ? [] : ["", "Kan du ikke få fat i køberen, eller bliver handlen ikke til noget, kan du annullere ordren i dit studie. Så får køberen pengene tilbage."]),
            ...SIGN,
          ].join("\n"),
        });
      }
    }
  } catch (e) {
    console.error("[relived] påmindelse om afhentning blev ikke sendt", orderId, e);
  }
}

/**
 * En pakke med Reliveds label er ikke scannet af fragtfirmaet flere dage efter, at labelen blev lavet
 * (0042_rettelser.sql). Sælgeren får en mail, og Relived får besked og afgør ordren under Sager.
 */
export async function mailScanMissing(admin: AdminClient, orderId: string) {
  try {
    const [o] = await fetchOrders(admin, [orderId]);
    if (!o) return;
    const { data } = await admin.from("orders").select("tracking,label_created_at").eq("id", orderId).maybeSingle();
    const t = (data ?? {}) as { tracking?: string | null; label_created_at?: string | null };
    const admins = adminEmails();
    const buyer = at(o.buyer?.handle, "køberen");
    const seller = at(o.seller?.handle, "sælgeren");
    const made = stamp(t.label_created_at ?? null);
    const carrier = isCarrier(o.sp_carrier) ? CARRIERS[o.sp_carrier] : null;
    const to = await emailOf(admin, o.seller_id);
    if (to) {
      await sendMail({
        to: [to],
        replyTo: admins,
        subject: `Din pakke til ${buyer} er ikke scannet endnu`,
        text: [
          "Hej",
          "",
          `Du lavede fragtlabelen til ${buyer} ${made}, men fragtfirmaet har ikke scannet pakken endnu:`,
          "",
          ...itemLines(o),
          "",
          "Ordren skifter først til Sendt, når pakken er scannet, og pengene bliver først sendt til dig, når køberen har fået den.",
          "",
          "Har du afleveret pakken, så svar på den her mail, gerne med kvitteringen fra pakkeshoppen. Så kigger vi på det.",
          "Har du ikke afleveret den endnu, så gør det nu. Kan du ikke sende den, kan du annullere ordren i dit studie, så køberen får pengene tilbage:",
          `${SITE_URL}/studio`,
          ...SIGN,
        ].join("\n"),
      });
    }
    await sendMail({
      to: admins,
      subject: `Pakke ikke scannet: ${at(o.buyer?.handle, "køber")} og ${at(o.seller?.handle, "sælger")}`,
      text: [
        `Labelen til en ordre blev lavet ${made}, men fragtfirmaet har ikke scannet pakken. Ordren står derfor stadig som betalt, og sælgeren får ikke sine penge.`,
        "",
        `Køber: ${at(o.buyer?.handle, "køber")}`,
        `Sælger: ${seller}`,
        "",
        ...itemLines(o),
        "",
        ...(carrier && t.tracking ? [`${carrier.name}, pakkenummer ${t.tracking}: ${carrier.track(t.tracking)}`] : []),
        ...(shopText(o) ? [`Til ${shopText(o)}`] : []),
        `Beløb: køberen betalte ${kr(o.total_amount)}, sælgeren skal have ${kr(o.items_amount)}`,
        `Ordre: ${orderId}`,
        "",
        "Sælgeren har fået en mail. Tjek sporingen hos fragtfirmaet. Er pakken afleveret, kan du markere ordren som sendt under Sager. Er den ikke, kan du give køberen pengene tilbage samme sted.",
        `${SITE_URL}/admin/sager`,
      ].join("\n"),
    });
  } catch (e) {
    console.error("[relived] besked om pakke uden scanning blev ikke sendt", orderId, e);
  }
}

/** Afhentningen er stadig ikke bekræftet af begge: Relived får besked og afgør ordren under Sager. */
export async function mailPickupFlag(admin: AdminClient, orderId: string) {
  try {
    const [o] = await fetchOrders(admin, [orderId]);
    if (!o) return;
    const { data } = await admin.from("orders").select("paid_at,pickup_buyer_at,pickup_seller_at").eq("id", orderId).maybeSingle();
    const t = (data ?? {}) as { paid_at?: string | null; pickup_buyer_at?: string | null; pickup_seller_at?: string | null };
    const said = (iso: string | null | undefined) => (iso ? `har bekræftet ${stamp(iso)}` : "har ikke bekræftet");
    await sendMail({
      to: adminEmails(),
      subject: `Afhentning ikke bekræftet: ${at(o.buyer?.handle, "køber")} og ${at(o.seller?.handle, "sælger")}`,
      text: [
        "En afhentning er ikke bekræftet af både køber og sælger, så pengene er ikke sendt til sælgeren.",
        "",
        `Køber: ${at(o.buyer?.handle, "køber")} ${said(t.pickup_buyer_at)}`,
        `Sælger: ${at(o.seller?.handle, "sælger")} ${said(t.pickup_seller_at)}`,
        "",
        ...itemLines(o),
        "",
        `Betalt: ${stamp(t.paid_at ?? null)}`,
        `Beløb: køberen betalte ${kr(o.total_amount)}, sælgeren skal have ${kr(sellerPayout(o))}`,
        `Ordre: ${orderId}`,
        "",
        "De har fået en påmindelse på mail. Skriv til dem, og afgør ordren under Sager: send pengene til sælgeren, eller giv køberen pengene tilbage.",
        `${SITE_URL}/admin/sager`,
      ].join("\n"),
    });
  } catch (e) {
    console.error("[relived] besked om afhentning blev ikke sendt", orderId, e);
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
    // Undtagelsen er en afhentning, som køber og sælger ikke begge har bekræftet (0041_afhentning.sql): dér har
    // Relived afgjort ordren, og begge får besked.
    const pickupCase = !issue && o.delivery === "pickup" && (outcome === "refund" || outcome === "release") ? outcome : null;
    if (!issue && outcome !== "seller_refund" && !pickupCase) {
      if (outcome !== "refund") return;
      outcome = "seller_refund";
    }
    const admins = adminEmails();
    const seller = at(o.seller?.handle, "sælgeren");
    const buyer = at(o.buyer?.handle, "køberen");
    const bank = "Pengene går tilbage til det kort eller den konto, du betalte med. Der kan gå nogle bankdage, før de står på din konto.";
    const ask = "Har du spørgsmål, kan du svare på den her mail.";
    if (pickupCase) {
      const why = "Afhentningen blev ikke bekræftet af jer begge, så vi har gennemgået ordren.";
      const msgs: [string, string, string[]][] =
        pickupCase === "release"
          ? [
              [o.buyer_id, "Din ordre er afsluttet", [`${why} Vi har afsluttet din ordre fra ${seller}, og pengene er sendt til sælgeren.`]],
              [o.seller_id, "Ordren er afsluttet: du får din udbetaling", [`${why} Vi har afsluttet ordren til ${buyer}, og pengene bliver sendt til din bankkonto.`]],
            ]
          : [
              [o.buyer_id, "Du har fået pengene tilbage", [`${why} Du får pengene tilbage for din ordre fra ${seller}: ${kr(o.total_amount)}.`, "", bank]],
              [
                o.seller_id,
                "Ordren er annulleret: køberen har fået pengene tilbage",
                [`${why} Køberen ${buyer} har fået pengene tilbage, så der kommer ingen udbetaling for ordren.`, "Varerne står ikke længere som solgt, så du kan sætte dem til salg igen."],
              ],
            ];
      for (const [uid, subject, text] of msgs) {
        const to = await emailOf(admin, uid);
        if (to) await sendMail({ to: [to], replyTo: admins, subject, text: ["Hej", "", ...text, "", ask, ...SIGN].join("\n") });
      }
      return;
    }

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
