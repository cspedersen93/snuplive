import Link from "next/link";

/** Ramme til vilkår og politikker: brødkrummer, overskrift og læsevenlig tekst. */
export default function LegalPage({ title, crumb, updated, children }: { title: string; crumb: string; updated: string; children: React.ReactNode }) {
  return (
    <section className="sec tight">
      <div className="wrap" style={{ maxWidth: 780 }}>
        <nav className="crumbs" aria-label="Brødkrummer" style={{ marginBottom: 18 }}>
          <Link href="/">Forside</Link>
          <span aria-hidden="true">/</span>
          <span>{crumb}</span>
        </nav>
        <div className="prose">
          <h1 className="h2">{title}</h1>
          {children}
          <p className="fine">Senest opdateret {updated}.</p>
        </div>
      </div>
    </section>
  );
}
