import type { Metadata } from "next";
import Link from "next/link";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/admin";
import { clock, dayLabel } from "@/lib/format";
import { targetInfo } from "@/lib/moderation";
import { isReportReason, isReportTarget, REPORT_REASONS } from "@/lib/reports";
import ReportActions from "./ReportActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anmeldelser" };

interface ReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  message: string | null;
  reporter_email: string | null;
  status: "open" | "removed" | "rejected";
  decision: string | null;
  created_at: string;
  decided_at: string | null;
  reporter: { handle: string } | null;
}

const SELECT = "id,target_type,target_id,reason,message,reporter_email,status,decision,created_at,decided_at,reporter:profiles!reports_reporter_id_fkey(handle)";
const at = (iso: string | null) => (iso ? `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}` : "–");
const reasonText = (r: string) => (isReportReason(r) ? REPORT_REASONS[r] : r);

/** Anmeldelser af ting, shows og profiler. Afgøres her, og sælgeren får begrundelsen på mail. */
export default async function Anmeldelser() {
  const { admin } = await requireAdmin("/admin/anmeldelser");
  if (!admin) return <SetupNotice />;

  const [openQ, doneQ] = await Promise.all([
    admin.from("reports").select(SELECT).eq("status", "open").order("created_at", { ascending: true }).limit(100),
    admin.from("reports").select(SELECT).neq("status", "open").order("decided_at", { ascending: false }).limit(20),
  ]);
  const open = (openQ.data ?? []) as unknown as ReportRow[];
  const done = (doneQ.data ?? []) as unknown as ReportRow[];

  // Flere anmeldelser af det samme vises som én sag.
  const groups = new Map<string, ReportRow[]>();
  for (const r of open) {
    const k = `${r.target_type}:${r.target_id}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const cases = await Promise.all(
    [...groups.values()].map(async (rows) => {
      const t = rows[0].target_type;
      const info = isReportTarget(t) ? await targetInfo(admin, t, rows[0].target_id) : null;
      return { rows, info, type: t };
    }),
  );
  const doneInfo = await Promise.all(done.map((r) => (isReportTarget(r.target_type) ? targetInfo(admin, r.target_type, r.target_id) : null)));

  return (
    <div className="adm-page" style={{ maxWidth: 900 }}>
      <div>
        <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", letterSpacing: "-.035em", lineHeight: 1.05, marginTop: 6 }}>Anmeldelser</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {cases.length
            ? `${cases.length} ${cases.length === 1 ? "sag venter" : "sager venter"}. Afgør dem hurtigst muligt, og skriv altid en begrundelse, når du fjerner noget.`
            : "Ingen anmeldelser venter lige nu."}
        </p>
      </div>

      {cases.map(({ rows, info, type }) => (
        <section className="box" key={rows[0].id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "baseline" }}>
            <strong>
              {info?.href ? <Link href={info.href} target="_blank">{info.label}</Link> : info?.label ?? type}
            </strong>
            {info?.owner ? <span className="muted">hos @{info.owner}</span> : null}
            {rows.length > 1 ? <span className="chip warn" style={{ marginLeft: "auto" }}>{rows.length} anmeldelser</span> : null}
          </div>
          {rows.map((r) => (
            <div className="issue-note" key={r.id}>
              <span>
                <b>{reasonText(r.reason)}.</b> {r.message ? <q>{r.message}</q> : null}
                <br />
                <span className="muted" style={{ fontSize: ".85rem" }}>
                  {r.reporter ? `@${r.reporter.handle}` : r.reporter_email ?? "Anonym"} · {at(r.created_at)}
                </span>
              </span>
            </div>
          ))}
          {isReportTarget(type) && !info?.removed ? (
            <ReportActions reportId={rows[0].id} type={type} />
          ) : (
            <ReportActions reportId={rows[0].id} type={null} />
          )}
        </section>
      ))}

      {done.length ? (
        <div className="box">
          <h2 className="h3" style={{ marginBottom: 6 }}>Afgjorte anmeldelser</h2>
          <ul className="list">
            {done.map((r, i) => (
              <li key={r.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div>
                  <strong>
                    {doneInfo[i]?.label ?? r.target_type} · {reasonText(r.reason)}
                  </strong>
                  <span>
                    {r.status === "removed" ? "Fjernet" : "Afvist"} {at(r.decided_at)}
                    {r.decision ? `: ${r.decision}` : "."}
                  </span>
                </div>
                <span className={`chip ${r.status === "removed" ? "warn" : ""}`}>{r.status === "removed" ? "Fjernet" : "Afvist"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
