import Link from "next/link";

/** Indholdet på 404-siden. Bruges både af app/not-found.tsx (ukendt adresse) og app/(site)/not-found.tsx. */
export default function NotFoundBody() {
  return (
    <section className="sec">
      <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
        <span className="label red">404</span>
        <h1 className="h2">Siden findes ikke</h1>
        <p className="lede">Måske er showet slut, eller linket er skrevet forkert.</p>
        <div className="ctas">
          <Link className="btn btn-ivory" href="/live">Se hvem der er live</Link>
          <Link className="btn btn-line" href="/">Til forsiden</Link>
        </div>
      </div>
    </section>
  );
}
