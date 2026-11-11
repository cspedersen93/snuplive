import type { Metadata } from "next";
import Link from "next/link";
import { BadgeIcon, LevelChip } from "@/components/Level";
import { BADGES, BADGE_ORDER, LEVEL_ORDER, levelNeeds, type Role } from "@/lib/levels";

// Forklaringen på niveauerne og mærkerne. Kravene kommer fra lib/levels.ts (samme tal som 0032_niveauer.sql).

export const metadata: Metadata = {
  title: { absolute: "Niveauer og mærker for sælgere og købere | Relived" },
  description:
    "Sådan får du Bronze, Sølv, Guld og VIP på Relived. Niveauet stiger med hver afsluttet handel og står ved dit navn i chatten og på din side.",
  alternates: { canonical: "/niveauer" },
};

function LevelTable({ role }: { role: Role }) {
  return (
    <table className="lvl-table">
      <thead>
        <tr>
          <th scope="col">Niveau</th>
          <th scope="col">Det kræver</th>
        </tr>
      </thead>
      <tbody>
        {LEVEL_ORDER.map((l) => (
          <tr key={l}>
            <td>
              <LevelChip level={l} role={role} full showNew />
            </td>
            <td>{levelNeeds(l, role)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Niveauer() {
  return (
    <>
      <section className="phero" aria-labelledby="h-niveauer">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Niveauer og mærker</span>
          </nav>
          <h1 className="h1" id="h-niveauer">Niveauer og mærker</h1>
          <p className="lede">
            Hver gang en handel er gennemført, kommer du et skridt tættere på næste niveau. Niveauet står ved dit navn i chatten, på
            din side og ved dine varer, så andre kan se, at du er god at handle med.
          </p>
          <div className="ctas" style={{ marginTop: 18 }}>
            <Link className="btn btn-ivory" href="/konto#niveau">Se dit niveau</Link>
            <Link className="btn btn-line" href="/live">Find et show</Link>
          </div>
        </div>
      </section>

      <section className="sec tight" aria-labelledby="h-saelger">
        <div className="wrap" style={{ display: "grid", gap: 36, gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
          <div>
            <h2 className="h3" id="h-saelger" style={{ marginBottom: 10 }}>Som sælger</h2>
            <LevelTable role="seller" />
          </div>
          <div>
            <h2 className="h3" style={{ marginBottom: 10 }}>Som køber</h2>
            <LevelTable role="buyer" />
          </div>
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-maerker">
        <div className="wrap">
          <h2 className="h2" id="h-maerker" style={{ marginBottom: 20 }}>Mærker</h2>
          <ul className="lvl-badges">
            {BADGE_ORDER.map((k) => (
              <li key={k}>
                <span className="mrk">
                  <BadgeIcon k={k} />
                  {BADGES[k].name}
                </span>
                {BADGES[k].text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-regler">
        <div className="wrap faq" style={{ display: "block", maxWidth: 820 }}>
          <h2 className="h2" id="h-regler" style={{ marginBottom: 18 }}>Godt at vide</h2>
          <div className="faq-list">
            <details open>
              <summary>
                <h3>Hvad tæller med?</h3>
                <span className="pm" aria-hidden="true">+</span>
              </summary>
              <p>
                Kun handler, der er helt gennemført: varen er betalt, sendt og modtaget. Køb, der bliver annulleret eller refunderet,
                tæller ikke. Køber du tre varer hos den samme sælger, tæller det som tre købte varer.
              </p>
            </details>
            <details>
              <summary>
                <h3>Hvad betyder stjerner og &quot;sendt til tiden&quot;?</h3>
                <span className="pm" aria-hidden="true">+</span>
              </summary>
              <p>
                Stjernerne er snittet af de bedømmelser, sælgeren har fået af køberne. Kravet gælder, når sælgeren har fået
                bedømmelser. En pakke er sendt til tiden, når den er sendt senest 5 dage efter, at køberen har betalt. Afhentninger
                tæller ikke med.
              </p>
            </details>
            <details>
              <summary>
                <h3>Kan andre se, hvad jeg køber?</h3>
                <span className="pm" aria-hidden="true">+</span>
              </summary>
              <p>
                Nej. Andre kan kun se dit niveau og dine mærker, aldrig hvad eller hvor meget du har købt. Vil du ikke vise dit
                køberniveau, kan du skjule det under Min konto. Sælgerens niveau kan altid ses, så køberne ved, hvem de handler med.
              </p>
            </details>
            <details>
              <summary>
                <h3>Hvordan bliver man VIP?</h3>
                <span className="pm" aria-hidden="true">+</span>
              </summary>
              <p>
                VIP er det højeste niveau. Du når det med 250 solgte varer som sælger (og kravene til Guld) eller 50 købte varer som
                køber. Relived kan også selv gøre en sælger eller køber til VIP.
              </p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
