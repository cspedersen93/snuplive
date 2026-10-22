import Link from "next/link";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import ShowsTable, { type ShowRow } from "../ShowsTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shows" };

const PER_PAGE = 50;

export default async function Shows({ searchParams }: { searchParams: Promise<{ side?: string }> }) {
  const { admin } = await requireAdmin("/admin/shows");
  if (!admin) return <SetupNotice />;
  const page = Math.max(1, Number((await searchParams).side) || 1);
  const { data, error } = await admin.rpc("admin_shows", { p_limit: PER_PAGE, p_offset: (page - 1) * PER_PAGE });
  const shows = (data ?? []) as ShowRow[];
  const total = Number(shows[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Shows</h1>
        <span className="muted">{num(total)} i alt</span>
      </div>
      {error ? <div className="notice" role="alert"><span>Shows kunne ikke hentes ({error.message}). Har du kørt 0006_backoffice.sql?</span></div> : null}
      {shows.length ? <ShowsTable shows={shows} /> : !error ? <div className="empty">Ingen shows endnu.</div> : null}
      {pages > 1 ? (
        <div className="adm-pager">
          {page > 1 ? <Link href={`/admin/shows?side=${page - 1}`}>← Forrige</Link> : <span />}
          <span>Side {page} af {pages}</span>
          {page < pages ? <Link href={`/admin/shows?side=${page + 1}`}>Næste →</Link> : <span />}
        </div>
      ) : null}
    </div>
  );
}
