import Link from "next/link";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import OrdersTable, { ORDER_SELECT, type AdminOrder } from "../OrdersTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ordrer" };

const PER_PAGE = 50;

const FILTERS = [
  { key: "alle", label: "Alle", status: ["paid", "shipped", "completed", "refunded"] },
  { key: "betalt", label: "Skal sendes", status: ["paid"] },
  { key: "sendt", label: "Sendt", status: ["shipped"] },
  { key: "afsluttet", label: "Afsluttet", status: ["completed"] },
  { key: "refunderet", label: "Refunderet", status: ["refunded"] },
  { key: "sager", label: "Med sag", status: ["paid", "shipped"] },
  { key: "ikke-betalt", label: "Ikke gennemført", status: ["pending", "cancelled"] },
] as const;

export default async function Ordrer({ searchParams }: { searchParams: Promise<{ vis?: string; side?: string }> }) {
  const { admin } = await requireAdmin("/admin/ordrer");
  if (!admin) return <SetupNotice />;
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.vis) ?? FILTERS[0];
  const page = Math.max(1, Number(sp.side) || 1);
  let query = admin
    .from("orders")
    .select(ORDER_SELECT, { count: "exact" })
    .in("status", [...filter.status]);
  if (filter.key === "sager") query = query.eq("issue_open", true);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const orders = (data ?? []) as unknown as AdminOrder[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const link = (p: number, vis = filter.key) =>
    `/admin/ordrer?${new URLSearchParams({ ...(vis !== "alle" ? { vis } : {}), ...(p > 1 ? { side: String(p) } : {}) })}`;

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Ordrer</h1>
        <span className="muted">{num(count ?? 0)} {count === 1 ? "ordre" : "ordrer"}</span>
      </div>
      <nav className="adm-periods" aria-label="Vis ordrer">
        {FILTERS.map((f) => (
          <Link key={f.key} href={link(1, f.key)} className="fchip" aria-current={f.key === filter.key ? "page" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>
      {error ? <div className="notice" role="alert"><span>Ordrerne kunne ikke hentes ({error.message}).</span></div> : null}
      {orders.length ? <OrdersTable orders={orders} /> : <div className="empty">Ingen ordrer her.</div>}
      {pages > 1 ? (
        <div className="adm-pager">
          {page > 1 ? <Link href={link(page - 1)}>← Forrige</Link> : <span />}
          <span>Side {page} af {pages}</span>
          {page < pages ? <Link href={link(page + 1)}>Næste →</Link> : <span />}
        </div>
      ) : null}
    </div>
  );
}
