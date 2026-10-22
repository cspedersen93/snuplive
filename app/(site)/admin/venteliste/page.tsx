import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import { clock, dayLabel } from "@/lib/format";
import { unquoteEnv } from "@/lib/env";
import { isWaitlistRole, WAITLIST_ROLES } from "@/lib/waitlist";
import WaitlistMail from "./WaitlistMail";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Venteliste" };

interface Row {
  email: string;
  role: string;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  source: string | null;
}

const at = (iso: string) => `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}`;

/** Ventelisten fra Kommer snart: hvem der har skrevet sig op, og mail til dem. */
export default async function Venteliste() {
  const { admin, user } = await requireAdmin("/admin/venteliste");
  if (!admin) return <SetupNotice />;
  const count = (q: ReturnType<typeof base>) => q.then((r) => r.count ?? 0);
  const base = () => admin.from("waitlist").select("id", { count: "exact", head: true });
  const [all, confirmed, sellers, unsub, rowsQ] = await Promise.all([
    count(base()),
    count(base().not("confirmed_at", "is", null).is("unsubscribed_at", null)),
    count(base().not("confirmed_at", "is", null).is("unsubscribed_at", null).in("role", ["seller", "both"])),
    count(base().not("unsubscribed_at", "is", null)),
    admin.from("waitlist").select("email,role,created_at,confirmed_at,unsubscribed_at,source").order("created_at", { ascending: false }).limit(200),
  ]);
  const rows = (rowsQ.data ?? []) as Row[];
  const mailReady = Boolean(unquoteEnv(process.env.RESEND_API_KEY));

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Venteliste</h1>
        <span className="muted">{num(all)} har skrevet sig op</span>
      </div>
      <div className="stats">
        <div className="stat"><span className="k">Bekræftede</span><span className="v">{num(confirmed)}</span><span className="d">får mails</span></div>
        <div className="stat"><span className="k">Vil sælge</span><span className="v">{num(sellers)}</span><span className="d">sælge eller begge dele</span></div>
        <div className="stat"><span className="k">Ikke bekræftet</span><span className="v">{num(all - confirmed - unsub)}</span></div>
        <div className="stat"><span className="k">Afmeldt</span><span className="v">{num(unsub)}</span></div>
      </div>
      {!mailReady ? (
        <div className="notice" role="alert">
          <span>Mails er ikke sat op (RESEND_API_KEY mangler), så ingen får bekræftelsesmailen. Læg nøglen ind i Vercel.</span>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="btn btn-red btn-sm" href="/api/admin/venteliste" download>Hent de bekræftede som CSV</a>
        <a className="btn btn-line btn-sm" href="/api/admin/venteliste?alle=1" download>Hent alle</a>
      </div>

      <WaitlistMail recipients={confirmed} sellers={sellers} me={user.email ?? ""} />

      {rows.length ? (
        <div className="table-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th scope="col">E-mail</th>
                <th scope="col">Vil gerne</th>
                <th scope="col">Skrev sig op</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email}>
                  <td>{r.email}</td>
                  <td>{isWaitlistRole(r.role) ? WAITLIST_ROLES[r.role] : r.role}</td>
                  <td className="muted">{at(r.created_at)}</td>
                  <td>
                    {r.unsubscribed_at ? (
                      <span className="muted">Afmeldt</span>
                    ) : r.confirmed_at ? (
                      <span className="chip ok">Bekræftet</span>
                    ) : (
                      <span className="chip">Venter på bekræftelse</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">Ingen har skrevet sig op endnu.</div>
      )}
    </div>
  );
}
