import Link from "next/link";
import Avatar from "@/components/Avatar";
import RemindButton from "@/components/RemindButton";
import { CATEGORIES, clock, dayLabel } from "@/lib/format";
import type { ShowWithSeller } from "@/lib/types";

/**
 * Programmet øverst på forsiden, som en tv-oversigt: hvem er live nu, og hvem går live hvornår.
 * Det show, der er live, står først med rød kant og "Se med". De andre har klokkeslæt og "Husk mig".
 */
export default function Program({ live, upcoming }: { live: ShowWithSeller[]; upcoming: ShowWithSeller[] }) {
  const shows = [...live, ...upcoming].slice(0, 8);
  if (!shows.length) return null;
  const tonight = live.length > 0 || upcoming.some((s) => s.starts_at && dayLabel(s.starts_at) === "I dag");
  return (
    <section className="prog" aria-labelledby="h-prog">
      <div className="prog-head">
        <h2 className="prog-h" id="h-prog">{tonight ? "I aften på Relived" : "Næste shows på Relived"}</h2>
        <Link className="prog-more" href="/live#h-sched">Se hele programmet</Link>
      </div>
      <ul className="prog-row">
        {shows.map((s) => {
          const handle = s.seller?.handle ?? "sælger";
          const on = s.status === "live";
          const cat = CATEGORIES.find((c) => c.key === s.category)?.short;
          return (
            <li key={s.id} className={`prog-card${on ? " on" : ""}`}>
              <div className="prog-top">
                {on ? (
                  <span className="prog-live">
                    <span className="live-dot white" aria-hidden="true" />
                    Live nu
                  </span>
                ) : s.starts_at ? (
                  <span className="prog-time">
                    {clock(s.starts_at)} <small>{dayLabel(s.starts_at).toLowerCase()}</small>
                  </span>
                ) : (
                  <span className="prog-time"><small>Tidspunkt kommer</small></span>
                )}
                {on ? (
                  <Link className="btn btn-ivory btn-sm" href={`/live/${handle}`}>Se med</Link>
                ) : (
                  <RemindButton showId={s.id} next="/" className="btn btn-line btn-sm" />
                )}
              </div>
              <Link className="prog-title" href={`/live/${handle}`}>{s.title}</Link>
              <span className="prog-who">
                <Avatar handle={handle} path={s.seller?.avatar_path} />
                <span>{[handle, cat].filter(Boolean).join(" · ")}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
