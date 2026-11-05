import Link from "next/link";
import { GREEN_FRIDAY, JULEKALENDER, campaignState, inDays, type CampaignFlags } from "@/lib/campaigns";

/**
 * Kortene til Green Friday og julekalenderen. Teksten følger datoen (nedtælling, "i aften", dagens låge),
 * og et kort forsvinder, når kampagnen er slut. Intet at vise → null.
 */
export default function CampaignCards({
  now = new Date(),
  flags,
  sellerLink = false,
}: {
  now?: Date;
  /** Kontakterne i Backoffice → Nyhedsbrev. Uden dem vises begge (bruges kun i test). */
  flags?: CampaignFlags;
  sellerLink?: boolean;
}) {
  const { gf, jk } = campaignState(now, flags);
  if (gf.phase === "over" && jk.phase === "over") return null;

  return (
    <div className="camp-cards">
      {gf.phase !== "over" ? (
        <article className="camp-card gf" id="green-friday" aria-labelledby="h-camp-gf">
          <div className="camp-top">
            <span className="camp-tag">Green Friday</span>
            <span className="camp-when">{gf.phase === "today" ? "I aften" : inDays(gf.days)}</span>
          </div>
          <p className="camp-date" aria-hidden="true">
            27.11<span>kl. {GREEN_FRIDAY.hour}</span>
          </p>
          <h3 id="h-camp-gf">Køb brugt, mens alle andre køber nyt</h3>
          <p>
            {gf.phase === "today" ? "I aften" : "Fredag 27. november"} kl. {GREEN_FRIDAY.hour} holder vi et stort live-show med alle
            vores stiftende sælgere efter hinanden. Gode fund og budsalg i stedet for nye varer.
          </p>
          {sellerLink ? (
            <Link className="camp-link" href="/saelg">Vil du sælge i showet? Se hvordan</Link>
          ) : null}
        </article>
      ) : null}

      {jk.phase !== "over" ? (
        <article className="camp-card jk" id="julekalender" aria-labelledby="h-camp-jk">
          <div className="camp-top">
            <span className="camp-tag">Julekalender</span>
            <span className="camp-when">
              {jk.phase === "before"
                ? `Starter ${inDays(jk.days)}`
                : `Låge ${jk.door} ${jk.tonight ? "i aften" : "i morgen"}`}
            </span>
          </div>
          <ol className="camp-doors" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => {
              const state = jk.phase !== "running" ? "" : n < jk.door ? " open" : n === jk.door ? " next" : "";
              return (
                <li key={n} className={`door${state}`}>
                  {n}
                </li>
              );
            })}
          </ol>
          <h3 id="h-camp-jk">24 låger, 24 live-shows</h3>
          <p>
            Hver aften kl. {JULEKALENDER.hour} fra 1. til 24. december åbner en ny låge: et live-show med én særlig vare på
            budsalg fra 1 kr. Find brugte julegaver, mens du ser med.
          </p>
        </article>
      ) : null}
    </div>
  );
}
