import Link from "next/link";

export default function NotFound() {
  return (
    <section className="sec">
      <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
        <span className="label red">404</span>
        <h1 className="h2">Siden findes ikke</h1>
        <p className="lede">Måske er showet slut, eller linket er skrevet forkert.</p>
        <div className="ctas">
          <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
          <Link className="btn btn-line" href="/">Til forsiden</Link>
        </div>
      </div>
    </section>
  );
}
