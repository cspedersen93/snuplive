import Stars from "@/components/Stars";
import { dayLabel } from "@/lib/format";

export interface Rating {
  stars: number;
  comment: string | null;
  created_at: string;
  buyer: { handle: string } | null;
}

/** De nyeste bedømmelser af sælgeren. Kun køberne af en afsluttet handel kan give dem. */
export default function SellerRatings({ handle, ratings, avg, count }: { handle: string; ratings: Rating[]; avg?: number | string | null; count?: number | null }) {
  if (!ratings.length) return null;
  return (
    <section className="ratings" aria-labelledby="h-bedoemmelser">
      <div className="row-head">
        <h2 className="h3" id="h-bedoemmelser">Hvad siger køberne om {handle}?</h2>
        <Stars avg={avg} count={count} />
      </div>
      <ul>
        {ratings.map((r, i) => (
          <li key={i}>
            <span className="stars" aria-label={`${r.stars} ud af 5 stjerner`}>
              {"★".repeat(r.stars)}
              <span className="dim">{"★".repeat(5 - r.stars)}</span>
            </span>
            {r.comment ? <p>{r.comment}</p> : null}
            <span className="muted">
              {r.buyer?.handle ?? "En køber"} · {dayLabel(r.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
