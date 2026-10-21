import type { Metadata } from "next";
import Link from "next/link";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import { DAC7_MIN_DKK, DAC7_MIN_EUR, DAC7_MIN_SALES, dac7Year, fetchDac7, mustReport, nearLimit } from "@/lib/dac7";
import { kr } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Indberetning til Skattestyrelsen" };

/** Listen til Skattestyrelsen (DAC7): hvem der skal indberettes, og hvor meget de har solgt pr. kvartal. */
export default async function Indberetning({ searchParams }: { searchParams: Promise<{ aar?: string }> }) {
  const { admin } = await requireAdmin("/admin/indberetning");
  if (!admin) return <SetupNotice />;
  const year = dac7Year((await searchParams).aar);
  const { rows, error } = await fetchDac7(admin, year);
  const report = rows.filter(mustReport);
  const near = rows.filter(nearLimit);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: Math.min(3, thisYear - 2025) }, (_, i) => thisYear - i);

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Indberetning til Skattestyrelsen</h1>
        <span className="muted">{year}</span>
      </div>
      <nav className="adm-periods" aria-label="Vælg år">
        {years.map((y) => (
          <Link key={y} href={`/admin/indberetning?aar=${y}`} className="fchip" aria-current={y === year ? "page" : undefined}>
            {y}
          </Link>
        ))}
      </nav>
      {error ? <div className="notice" role="alert"><span>Listen kunne ikke hentes ({error.message}).</span></div> : null}

      <div className="notice ok" role="note">
        <span>
          Sælgere med mindst {DAC7_MIN_SALES} salg eller salg for mindst {num(DAC7_MIN_EUR)} euro (ca. {kr(DAC7_MIN_DKK)}) i {year} skal
          indberettes senest 31. januar {year + 1} via Skattestyrelsens løsning for digitale platforme. Navn, adresse, CPR- eller
          CVR-nummer, fødselsdato og bankkonto står i sælgerens Stripe-konto.
        </span>
      </div>

      <div className="stats">
        <div className="stat"><span className="k">Sælgere med salg</span><span className="v">{num(rows.length)}</span></div>
        <div className="stat"><span className="k">Skal indberettes</span><span className="v">{num(report.length)}</span></div>
        <div className="stat"><span className="k">Tæt på grænsen</span><span className="v">{num(near.length)}</span></div>
        <div className="stat">
          <span className="k">Solgt i alt</span>
          <span className="v">{kr(rows.reduce((a, r) => a + r.amount, 0))}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="btn btn-red btn-sm" href={`/api/admin/indberetning?aar=${year}`} download>Hent listen som CSV</a>
        <a className="btn btn-line btn-sm" href={`/api/admin/indberetning?aar=${year}&alle=1`} download>Hent alle sælgere</a>
      </div>

      {rows.length ? (
        <div className="table-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th scope="col">Sælger</th>
                <th scope="col">Type</th>
                <th scope="col" className="r">Salg</th>
                <th scope="col" className="r">Solgt for</th>
                <th scope="col" className="r">1. kvt.</th>
                <th scope="col" className="r">2. kvt.</th>
                <th scope="col" className="r">3. kvt.</th>
                <th scope="col" className="r">4. kvt.</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.seller_id}>
                  <td>
                    <Link href={`/admin/medlemmer/${r.seller_id}`}>@{r.handle}</Link>
                    <span className="sub">{[r.display_name, r.email].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td>
                    {r.seller_type === "business" ? `Erhverv: ${r.business_name}` : "Privat"}
                    {r.business_cvr ? <span className="sub">CVR {r.business_cvr}</span> : null}
                  </td>
                  <td className="num">{num(r.sales)}</td>
                  <td className="num">{kr(r.amount)}</td>
                  <td className="num">{kr(Number(r.q1))}</td>
                  <td className="num">{kr(Number(r.q2))}</td>
                  <td className="num">{kr(Number(r.q3))}</td>
                  <td className="num">{kr(Number(r.q4))}</td>
                  <td>
                    {mustReport(r) ? (
                      <span className="chip warn">Indberettes</span>
                    ) : nearLimit(r) ? (
                      <span className="chip">Tæt på</span>
                    ) : (
                      <span className="muted">Under grænsen</span>
                    )}
                    {!r.stripe_account_id && mustReport(r) ? <span className="sub">Mangler Stripe-konto</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">Ingen salg i {year} endnu.</div>
      )}
    </div>
  );
}
