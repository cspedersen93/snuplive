import Link from "next/link";
import Avatar from "@/components/Avatar";
import RemindButton from "@/components/RemindButton";
import { CATEGORIES, clock, dayLabel } from "@/lib/format";
import type { ShowWithSeller } from "@/lib/types";

/**
 * Programmet øverst på forsiden, som en tv-oversigt: hvem er live nu, og hvem går live hvornår.
 * Det show, der er live, står først med rød kant og "Se med". De andre har klokkeslæt og "Husk mig".
 * Er der under tre shows, står der til sidst et kort, der inviterer sælgere til at sætte et show på.
 */
export default function Program({ live, upcoming }: { live: ShowWithSeller[]; upcoming: ShowWithSeller[] }) {
  const shows = [...live, ...upcoming].slice(0, 8);
  if (!shows.length) return null;
  // "I aften" kun, når noget faktisk sker i aften (fra kl. 17 dansk tid). Ellers "I dag" eller "Næste shows".
  const today = upcoming.filter((s) => s.starts_at && dayLabel(s.starts_at) === "I dag");
  const hour = (iso: string) => Number(new Intl.DateTimeFormat("da-DK", { hour: "numeric", hour12: false, timeZone: "Europe/Copenhagen" }).format(new Date(iso)));
  const evening = today.some((s) => hour(s.starts_at as string) >= 17) || (live.length > 0 && hour(new Date().toISOString()) >= 17);
  const heading = evening ? "I aften på Relived" : live.length || today.length ? "I dag på Relived" : "Næste shows på Relived";
  return (
    <section className="prog" aria-labelledby="h-prog">
      <div className="prog-head">
        <h2 className="prog-h" id="h-prog">{heading}</h2>
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
        {shows.length < 3 ? (
          <li className="prog-card prog-invite">
            <span className="prog-time"><small>Ledig plads i programmet</small></span>
            <span className="prog-title">Har du varer, der skal videre? Sæt dit eget show på.</span>
            <Link className="btn btn-line btn-sm" href="/saelg">Sådan sælger du live</Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
