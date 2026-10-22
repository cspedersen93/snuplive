import Link from "next/link";
import { num } from "@/lib/admin";
import { category, clock, dayLabel, kr } from "@/lib/format";

export interface ShowRow {
  id: string;
  title: string;
  status: "planned" | "live" | "ended";
  category: string;
  starts_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  seller_id: string;
  handle: string;
  items: number;
  sold: number;
  revenue: number;
  total: number;
}

const STATUS: Record<ShowRow["status"], [string, string]> = { live: ["live", "Live"], planned: ["warn", "Planlagt"], ended: ["sold", "Slut"] };
const when = (iso: string | null) => (iso ? `${dayLabel(iso)} ${clock(iso)}` : "–");

export default function ShowsTable({ shows }: { shows: ShowRow[] }) {
  return (
    <div className="table-wrap">
      <table className="dtable" style={{ minWidth: 760 }}>
        <thead>
          <tr>
            <th scope="col">Show</th>
            <th scope="col">Sælger</th>
            <th scope="col">Status</th>
            <th scope="col">Tid</th>
            <th scope="col" className="r">Solgt</th>
            <th scope="col" className="r">Omsætning</th>
          </tr>
        </thead>
        <tbody>
          {shows.map((s) => (
            <tr key={s.id}>
              <td>
                {s.status === "live" ? <Link href={`/live/${s.handle}`}><b>{s.title}</b></Link> : <b>{s.title}</b>}
                <span className="sub">{category(s.category).label}</span>
              </td>
              <td><Link href={`/admin/medlemmer/${s.seller_id}`}>@{s.handle}</Link></td>
              <td><span className={`chip ${STATUS[s.status][0]}`}>{STATUS[s.status][1]}</span></td>
              <td>
                {s.status === "planned" ? when(s.starts_at) : when(s.started_at)}
                {s.status === "ended" && s.ended_at && s.started_at ? (
                  <span className="sub">{Math.max(1, Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60000))} min</span>
                ) : null}
              </td>
              <td className="r num">
                {num(s.sold)} af {num(s.items)}
              </td>
              <td className="r num">{kr(Number(s.revenue))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

