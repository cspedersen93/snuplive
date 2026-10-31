import Link from "next/link";
import { CARRIERS, isCarrier } from "@/lib/carriers";
import { clock, dayLabel, kr } from "@/lib/format";
import { sellerPayout } from "@/lib/pricing";

const STATUS: Record<string, [string, string]> = {
  pending: ["", "Venter på betaling"],
  cancelled: ["", "Ikke gennemført"],
  paid: ["warn", "Betalt"],
  shipped: ["live", "Sendt"],
  completed: ["ok", "Afsluttet"],
  refunded: ["sold", "Refunderet"],
};
const TRANSFER: Record<string, string> = { none: "", pending: "Udbetaling venter", done: "Udbetalt", failed: "Udbetaling fejlede" };

export interface AdminOrder {
  id: string;
  status: string;
  delivery: "ship" | "pickup";
  items_amount: number;
  shipping_amount: number;
  fee_amount: number;
  total_amount: number;
  sp_id: string | null;
  sp_carrier: string | null;
  sp_name: string | null;
  tracking: string | null;
  transfer_status: string;
  issue_open: boolean;
  created_at: string;
  paid_at: string | null;
  buyer_id: string;
  seller_id: string;
  buyer: { handle: string } | null;
  seller: { handle: string } | null;
  show: { title: string } | null;
  sales: { id: string }[];
}

export const ORDER_SELECT =
  "id,status,delivery,items_amount,shipping_amount,fee_amount,total_amount,sp_id,sp_carrier,sp_name,tracking,transfer_status,issue_open,created_at,paid_at,buyer_id,seller_id,buyer:profiles!orders_buyer_id_fkey(handle),seller:profiles!orders_seller_id_fkey(handle),show:shows!orders_show_id_fkey(title),sales:sales!sales_order_id_fkey(id)";

const when = (iso: string | null) => (iso ? `${dayLabel(iso)} ${clock(iso)}` : "–");

export default function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  return (
    <div className="table-wrap">
      <table className="dtable" style={{ minWidth: 860 }}>
        <thead>
          <tr>
            <th scope="col">Dato</th>
            <th scope="col">Køber → sælger</th>
            <th scope="col">Levering</th>
            <th scope="col">Status</th>
            <th scope="col" className="r">Beløb</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                {when(o.paid_at ?? o.created_at)}
                <span className="sub">#{o.id.slice(0, 8)}</span>
              </td>
              <td>
                <Link href={`/admin/medlemmer/${o.buyer_id}`}>@{o.buyer?.handle}</Link> →{" "}
                <Link href={`/admin/medlemmer/${o.seller_id}`}>@{o.seller?.handle}</Link>
                <span className="sub">
                  {o.show?.title} · {o.sales.length} {o.sales.length === 1 ? "vare" : "varer"}
                </span>
              </td>
              <td>
                {o.delivery === "pickup" ? "Afhentning" : o.sp_name ? `${isCarrier(o.sp_carrier) ? CARRIERS[o.sp_carrier].name : ""} pakkeshop` : "Sælger sender"}
                <span className="sub">{o.sp_name ?? (o.tracking ? `Sporing ${o.tracking}` : "")}</span>
              </td>
              <td>
                <span className={`chip ${STATUS[o.status]?.[0] ?? ""}`}>{STATUS[o.status]?.[1] ?? o.status}</span>
                {o.issue_open ? <span className="chip warn" style={{ marginLeft: 6 }}>Sag</span> : null}
                {TRANSFER[o.transfer_status] ? <span className="sub">{TRANSFER[o.transfer_status]}</span> : null}
              </td>
              <td className="r num">
                {kr(o.total_amount)}
                <span className="sub">
                  {o.status === "refunded"
                    ? "Refunderet til køberen"
                    : `Sælger ${kr(sellerPayout(o))} · beskyttelse ${kr(o.fee_amount)}`}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

