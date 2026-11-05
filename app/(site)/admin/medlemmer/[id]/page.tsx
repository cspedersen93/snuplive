import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import { clock, dayLabel, kr, vareOrd } from "@/lib/format";
import OrdersTable, { ORDER_SELECT, type AdminOrder } from "../../OrdersTable";
import ShowsTable, { type ShowRow } from "../../ShowsTable";
import type { MemberRow } from "../../types";
import { BadgeList, LevelChip } from "@/components/Level";
import { toProgress } from "@/lib/levels";
import VipToggle from "./VipToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Medlem" };

const when = (iso: string | null) => (iso ? `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}` : "–");

export default async function Medlem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin } = await requireAdmin(`/admin/medlemmer/${id}`);
  if (!admin) return <SetupNotice />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [memberQ, boughtQ, soldQ, showsQ, unpaidQ, addrQ] = await Promise.all([
    admin.rpc("admin_members", { p_id: id, p_limit: 1, p_offset: 0 }),
    admin.from("orders").select(ORDER_SELECT).eq("buyer_id", id).neq("status", "pending").order("created_at", { ascending: false }).limit(20),
    admin.from("orders").select(ORDER_SELECT).eq("seller_id", id).neq("status", "pending").order("created_at", { ascending: false }).limit(20),
    admin.rpc("admin_shows", { p_limit: 20, p_offset: 0, p_seller: id }),
    admin.from("sales").select("id,price").eq("buyer_id", id).eq("status", "reserved"),
    admin.from("seller_addresses").select("name,address1,address2,zipcode,city,phone").eq("user_id", id).maybeSingle(),
  ]);
  const m = ((memberQ.data ?? []) as MemberRow[])[0];
  if (!m) notFound();
  const bought = (boughtQ.data ?? []) as unknown as AdminOrder[];
  const sold = (soldQ.data ?? []) as unknown as AdminOrder[];
  const shows = (showsQ.data ?? []) as ShowRow[];
  const unpaid = (unpaidQ.data ?? []) as { price: number }[];
  // Niveau og mærker (findes først, når 0032_niveauer.sql er kørt).
  const lq = await admin.rpc("member_progress", { p_id: id });
  const lv = lq.error ? null : toProgress(lq.data);
  const addr = addrQ.data as { name: string; address1: string; address2: string | null; zipcode: string; city: string; phone: string | null } | null;

  return (
    <div className="adm-page">
      <p style={{ fontSize: ".9rem" }}><Link href="/admin/medlemmer">← Alle medlemmer</Link></p>
      <div className="seller-row" style={{ gap: 14 }}>
        <Avatar handle={m.handle} path={m.avatar_path} />
        <div>
          <h1 style={{ fontSize: "clamp(1.4rem,3vw,1.9rem)", letterSpacing: "-.03em" }}>@{m.handle}</h1>
          <span className="muted">{[m.display_name, m.area, m.is_seller ? "Sælger" : "Køber"].filter(Boolean).join(" · ")}</span>
        </div>
      </div>

      <div className="box">
        <dl className="adm-facts">
          <div><dt>E-mail</dt><dd><a href={`mailto:${m.email}`}>{m.email}</a></dd></div>
          <div><dt>Medlem siden</dt><dd>{when(m.created_at)}</dd></div>
          <div><dt>Har købt</dt><dd>{num(m.purchases)} {Number(m.purchases) === 1 ? "ordre" : "ordrer"} · {kr(Number(m.spent))}</dd></div>
          <div><dt>Ubetalte køb</dt><dd>{unpaid.length ? `${unpaid.length} for ${kr(unpaid.reduce((a, b) => a + b.price, 0))}` : "Ingen"}</dd></div>
          {m.is_seller ? (
            <>
              <div><dt>Har solgt</dt><dd>{num(m.items_sold)} {vareOrd(m.items_sold)} · {kr(Number(m.earned))}</dd></div>
              <div><dt>Shows</dt><dd>{num(m.shows)}</dd></div>
              <div><dt>Udbetaling</dt><dd>{m.payout_ready ? "Klar hos Stripe" : "Ikke tilknyttet endnu"}</dd></div>
              <div>
                <dt>Afsenderadresse</dt>
                <dd>{addr ? `${addr.name}, ${addr.address1}${addr.address2 ? `, ${addr.address2}` : ""}, ${addr.zipcode} ${addr.city}${addr.phone ? ` · ${addr.phone}` : ""}` : "Ikke udfyldt"}</dd>
              </div>
            </>
          ) : null}
          <div><dt>Åbne sager</dt><dd>{Number(m.open_issues) ? <Link href="/admin/sager">{m.open_issues}</Link> : "Ingen"}</dd></div>
          <div><dt>Blokeret af sælgere</dt><dd>{Number(m.blocked_by) ? num(m.blocked_by) : "Ingen"}</dd></div>
        </dl>
      </div>

      {lv ? (
        <div className="box">
          <h2 className="h3" style={{ marginBottom: 8 }}>Niveau og mærker</h2>
          <dl className="adm-facts">
            {lv.seller_level ? (
              <div>
                <dt>Som sælger</dt>
                <dd>
                  <LevelChip level={lv.seller_level} role="seller" full showNew /> · {num(lv.sold)} solgte {vareOrd(lv.sold)}
                  {lv.shipped ? ` · ${num(lv.on_time)} af ${num(lv.shipped)} pakker sendt til tiden` : ""}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Som køber</dt>
              <dd>
                <LevelChip level={lv.buyer_level} role="buyer" full showNew /> · {num(lv.bought)} købte {vareOrd(lv.bought)}
                {lv.hide_buyer_level ? " · skjult for andre" : ""}
              </dd>
            </div>
            <div>
              <dt>Mærker</dt>
              <dd>{lv.badges.length ? <BadgeList badges={lv.badges} /> : "Ingen endnu"}</dd>
            </div>
          </dl>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {m.is_seller ? <VipToggle user={id} role="seller" value={lv.vip_seller} label="VIP-sælger" /> : null}
            <VipToggle user={id} role="buyer" value={lv.vip_buyer} label="VIP-køber" />
          </div>
        </div>
      ) : null}

      {m.is_seller ? (
        <>
          <h2 className="h3">Salg</h2>
          {sold.length ? <OrdersTable orders={sold} /> : <div className="empty">Ingen salg endnu.</div>}
          <h2 className="h3">Shows</h2>
          {shows.length ? <ShowsTable shows={shows} /> : <div className="empty">Ingen shows endnu.</div>}
        </>
      ) : null}
      <h2 className="h3">Køb</h2>
      {bought.length ? <OrdersTable orders={bought} /> : <div className="empty">Ingen køb endnu.</div>}
    </div>
  );
}
