import Link from "next/link";
import Avatar from "@/components/Avatar";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import { dayLabel, kr } from "@/lib/format";
import type { MemberRow } from "../types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Medlemmer" };

const PER_PAGE = 50;

export default async function Medlemmer({ searchParams }: { searchParams: Promise<{ q?: string; side?: string }> }) {
  const { admin } = await requireAdmin("/admin/medlemmer");
  if (!admin) return <SetupNotice />;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(sp.side) || 1);
  const { data, error } = await admin.rpc("admin_members", { p_query: q || null, p_limit: PER_PAGE, p_offset: (page - 1) * PER_PAGE });
  const rows = (data ?? []) as MemberRow[];
  const total = Number(rows[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const link = (p: number) => `/admin/medlemmer?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { side: String(p) } : {}) })}`;

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Medlemmer</h1>
        <span className="muted">{q ? `${num(total)} fundet` : `${num(total)} i alt`}</span>
      </div>
      <form className="adm-search" action="/admin/medlemmer">
        <div className="field">
          <label htmlFor="q">Søg på brugernavn, navn eller e-mail</label>
          <input id="q" name="q" defaultValue={q} placeholder="Fx maja eller @gmail.com" />
        </div>
        <button className="btn btn-line btn-sm" type="submit">Søg</button>
        {q ? <Link className="btn btn-ghost btn-sm" href="/admin/medlemmer">Ryd</Link> : null}
      </form>
      {error ? <div className="notice" role="alert"><span>Medlemmerne kunne ikke hentes ({error.message}). Har du kørt 0006_backoffice.sql?</span></div> : null}
      {rows.length ? (
        <div className="table-wrap">
          <table className="dtable" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th scope="col">Medlem</th>
                <th scope="col">E-mail</th>
                <th scope="col">Oprettet</th>
                <th scope="col">Rolle</th>
                <th scope="col" className="r">Køb</th>
                <th scope="col" className="r">Salg</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="it">
                      <Avatar handle={m.handle} path={m.avatar_path} />
                      <div>
                        <Link href={`/admin/medlemmer/${m.id}`}><b>@{m.handle}</b></Link>
                        <span className="sub">
                          {[m.display_name, m.area].filter(Boolean).join(" · ") || "–"}
                          {Number(m.open_issues) ? ` · ${m.open_issues} åben sag` : ""}
                          {Number(m.blocked_by) ? ` · blokeret af ${m.blocked_by}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td><a href={`mailto:${m.email}`}>{m.email}</a></td>
                  <td>{dayLabel(m.created_at)}</td>
                  <td>
                    {m.is_seller ? "Sælger" : "Køber"}
                    {m.is_seller ? <span className="sub">{m.payout_ready ? "Udbetaling klar" : "Mangler udbetaling"}</span> : null}
                  </td>
                  <td className="r num">
                    {num(m.purchases)}
                    <span className="sub">{kr(Number(m.spent))}</span>
                  </td>
                  <td className="r num">
                    {m.is_seller ? num(m.items_sold) : "–"}
                    {m.is_seller ? <span className="sub">{kr(Number(m.earned))}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !error ? (
        <div className="empty">{q ? "Ingen medlemmer passer på søgningen." : "Ingen medlemmer endnu."}</div>
      ) : null}
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
