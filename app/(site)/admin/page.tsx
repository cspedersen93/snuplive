import Link from "next/link";
import Avatar from "@/components/Avatar";
import SetupNotice from "@/components/SetupNotice";
import { num, PERIODS, periodStart, requireAdmin } from "@/lib/admin";
import { clock, dayLabel, kr } from "@/lib/format";
import OverviewChart, { type Bucket } from "./OverviewChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overblik" };

interface Overview {
  members_total: number;
  members_new: number;
  sellers_total: number;
  sellers_payout_ready: number;
  shows_held: number;
  shows_live: number;
  shows_planned: number;
  items_sold: number;
  orders: number;
  buyers: number;
  gmv: number;
  items_value: number;
  fees: number;
  shipping_labels_paid: number;
  label_cost: number;
  labels: number;
  refunded: number;
  refunded_count: number;
  paid_out: number;
  held_now: number;
  held_orders: number;
  awaiting_payout: number;
  open_issues: number;
  unpaid_snups: number;
  unpaid_value: number;
}

interface Day {
  day: string;
  orders: number;
  gmv: number;
  fees: number;
  signups: number;
}

const ORDER_STATUS: Record<string, [string, string]> = {
  paid: ["warn", "Betalt"],
  shipped: ["live", "Sendt"],
  completed: ["ok", "Afsluttet"],
  refunded: ["sold", "Refunderet"],
};

const longDay = new Intl.DateTimeFormat("da-DK", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("da-DK", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("da-DK", { month: "long", year: "numeric", timeZone: "UTC" });

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7);
}

/** Dage → søjler: pr. dag op til en måned, pr. uge op til fire måneder, ellers pr. måned. */
function toBuckets(days: Day[]): { unit: string; buckets: Bucket[] } {
  const unit = days.length <= 31 ? "dag" : days.length <= 120 ? "uge" : "måned";
  const map = new Map<string, Bucket>();
  for (const r of days) {
    const d = new Date(`${String(r.day).slice(0, 10)}T00:00:00Z`);
    let key: string, label: string, title: string;
    if (unit === "dag") {
      key = r.day;
      label = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
      title = longDay.format(d);
    } else if (unit === "uge") {
      const w = isoWeek(d);
      key = `${d.getUTCFullYear()}-${w}`;
      label = `uge ${w}`;
      title = `Uge ${w}`;
    } else {
      key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      label = monthShort.format(d);
      title = monthLong.format(d);
    }
    const b = map.get(key) ?? { label, title, gmv: 0, orders: 0, fees: 0, signups: 0 };
    b.gmv += Number(r.gmv);
    b.orders += Number(r.orders);
    b.fees += Number(r.fees);
    b.signups += Number(r.signups);
    map.set(key, b);
  }
  return { unit, buckets: [...map.values()] };
}

const when = (iso: string | null) => (iso ? `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}` : "");

export default async function Overblik({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const { admin } = await requireAdmin("/admin");
  if (!admin) return <SetupNotice />;
  const period = periodStart((await searchParams).periode);
  const from = period.from.toISOString();

  const [ovQ, dailyQ, topQ, ordersQ, membersQ] = await Promise.all([
    admin.rpc("admin_overview", { p_from: from }),
    admin.rpc("admin_daily", { p_from: from }),
    admin.rpc("admin_top_sellers", { p_from: from, p_limit: 5 }),
    admin
      .from("orders")
      .select("id,status,total_amount,paid_at,issue_open,buyer:profiles!orders_buyer_id_fkey(handle),seller:profiles!orders_seller_id_fkey(handle)")
      .in("status", ["paid", "shipped", "completed", "refunded"])
      .order("paid_at", { ascending: false })
      .limit(6),
    admin.from("profiles").select("id,handle,display_name,avatar_path,is_seller,created_at").order("created_at", { ascending: false }).limit(6),
  ]);
  if (ovQ.error) {
    return (
      <div className="notice" role="alert">
        <span>
          Tallene kunne ikke hentes. Har du kørt <code>supabase/migrations/0006_backoffice.sql</code> i Supabase? ({ovQ.error.message})
        </span>
      </div>
    );
  }
  const o = Object.fromEntries(Object.entries((ovQ.data ?? {}) as Record<string, unknown>).map(([k, v]) => [k, Number(v ?? 0)])) as unknown as Overview;
  const { unit, buckets } = toBuckets((dailyQ.data ?? []) as Day[]);
  const top = (topQ.data ?? []) as { seller_id: string; handle: string; avatar_path: string | null; orders: number; items: number; items_value: number }[];
  const latest = (ordersQ.data ?? []) as unknown as {
    id: string;
    status: string;
    total_amount: number;
    paid_at: string | null;
    issue_open: boolean;
    buyer: { handle: string } | null;
    seller: { handle: string } | null;
  }[];
  const members = (membersQ.data ?? []) as { id: string; handle: string; display_name: string | null; avatar_path: string | null; is_seller: boolean; created_at: string }[];

  const shippingMargin = o.shipping_labels_paid - o.label_cost;
  const earnings = o.fees + shippingMargin;

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Overblik</h1>
        <nav className="adm-periods" aria-label="Periode">
          {PERIODS.map((p) => (
            <Link key={p.key} href={p.key === "30" ? "/admin" : `/admin?periode=${p.key}`} className="fchip" aria-current={p.key === period.key ? "page" : undefined}>
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      {o.open_issues ? (
        <div className="notice" role="status">
          <span>
            <b>{o.open_issues} {o.open_issues === 1 ? "åben sag" : "åbne sager"}</b> venter på dig. <Link href="/admin/sager">Gå til sager</Link>
          </span>
        </div>
      ) : null}

      <section className="adm-hero" aria-label="Omsætning">
        <span className="k">Omsætning · {period.label.toLowerCase()}</span>
        <span className="v">{kr(o.gmv)}</span>
        <span className="d">
          {num(o.orders)} {o.orders === 1 ? "ordre" : "ordrer"} fra {num(o.buyers)} {o.buyers === 1 ? "køber" : "købere"} · ting for {kr(o.items_value)}
        </span>
      </section>

      <div className="stats adm-kpis">
        <div className="stat">
          <span className="k">Din indtjening</span>
          <span className="v">{kr(earnings)}</span>
          <span className="d muted">
            Køberbeskyttelse {kr(o.fees)}
            {o.labels ? ` · fragt minus labels ${kr(shippingMargin)}` : ""}
          </span>
        </div>
        <div className="stat">
          <span className="k">Udbetalt til sælgere</span>
          <span className="v">{kr(o.paid_out)}</span>
          <span className="d muted">{o.awaiting_payout ? `${kr(o.awaiting_payout)} venter på udbetaling` : "Ingen udbetalinger venter"}</span>
        </div>
        <div className="stat">
          <span className="k">Holdes tilbage lige nu</span>
          <span className="v">{kr(o.held_now)}</span>
          <span className="d muted">{num(o.held_orders)} {o.held_orders === 1 ? "ordre" : "ordrer"} på vej til køberen</span>
        </div>
        <div className="stat">
          <span className="k">Refunderet</span>
          <span className="v">{kr(o.refunded)}</span>
          <span className="d muted">{num(o.refunded_count)} {o.refunded_count === 1 ? "ordre" : "ordrer"}</span>
        </div>
        <Link className="stat" href="/admin/medlemmer" style={{ textDecoration: "none" }}>
          <span className="k">Medlemmer</span>
          <span className="v">{num(o.members_total)}</span>
          <span className="d">+{num(o.members_new)} i perioden</span>
        </Link>
        <div className="stat">
          <span className="k">Sælgere</span>
          <span className="v">{num(o.sellers_total)}</span>
          <span className="d muted">{num(o.sellers_payout_ready)} med udbetaling klar</span>
        </div>
        <Link className="stat" href="/admin/shows" style={{ textDecoration: "none" }}>
          <span className="k">Shows holdt</span>
          <span className="v">{num(o.shows_held)}</span>
          <span className="d muted">
            {num(o.shows_live)} live nu · {num(o.shows_planned)} planlagt
          </span>
        </Link>
        <div className="stat">
          <span className="k">Solgte ting</span>
          <span className="v">{num(o.items_sold)}</span>
          <span className="d muted">
            {o.unpaid_snups ? `${num(o.unpaid_snups)} køb for ${kr(o.unpaid_value)} venter på betaling` : "Ingen køb venter på betaling"}
          </span>
        </div>
      </div>
      <p className="fine">
        Indtjeningen er før Stripes gebyrer og moms. Gebyrerne kan du se i Stripe under Balances. Omsætningen er det, køberne
        har betalt (ting, fragt og køberbeskyttelse) for ordrer, der ikke er refunderet.
      </p>

      <OverviewChart buckets={buckets} unit={unit} />

      <div className="cols2">
        <div className="box">
          <h2 className="h3" style={{ marginBottom: 6 }}>Mest solgt · {period.label.toLowerCase()}</h2>
          {top.length ? (
            <ul className="list">
              {top.map((t) => (
                <li key={t.seller_id}>
                  <Avatar handle={t.handle} path={t.avatar_path} />
                  <div>
                    <strong><Link href={`/admin/medlemmer/${t.seller_id}`}>@{t.handle}</Link></strong>
                    <span>{num(t.items)} ting i {num(t.orders)} {Number(t.orders) === 1 ? "ordre" : "ordrer"}</span>
                  </div>
                  <span className="num">{kr(Number(t.items_value))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: ".92rem" }}>Ingen salg i perioden endnu.</p>
          )}
        </div>
        <div className="box">
          <h2 className="h3" style={{ marginBottom: 6 }}>Nyeste medlemmer</h2>
          <ul className="list">
            {members.map((m) => (
              <li key={m.id}>
                <Avatar handle={m.handle} path={m.avatar_path} />
                <div>
                  <strong><Link href={`/admin/medlemmer/${m.id}`}>@{m.handle}</Link></strong>
                  <span>{m.display_name ? `${m.display_name} · ` : ""}{m.is_seller ? "sælger · " : ""}{when(m.created_at)}</span>
                </div>
                <span />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h2 className="h3">Seneste ordrer</h2>
          <Link href="/admin/ordrer" style={{ fontSize: ".9rem" }}>Se alle ordrer</Link>
        </div>
        {latest.length ? (
          <ul className="list">
            {latest.map((r) => (
              <li key={r.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
                <div>
                  <strong>@{r.buyer?.handle} køber hos @{r.seller?.handle}</strong>
                  <span>{when(r.paid_at)}{r.issue_open ? " · problem meldt" : ""}</span>
                </div>
                <span className={`chip ${ORDER_STATUS[r.status]?.[0] ?? ""}`}>{ORDER_STATUS[r.status]?.[1] ?? r.status}</span>
                <span className="num">{kr(r.total_amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ fontSize: ".92rem" }}>Ingen ordrer endnu.</p>
        )}
      </div>
    </div>
  );
}
