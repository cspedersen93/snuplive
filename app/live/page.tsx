import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { category, clock, dayLabel } from "@/lib/format";
import { fetchListing, itemCount } from "@/lib/queries";
import LiveGrid from "./LiveGrid";

export const revalidate = 15;

export const metadata: Metadata = {
  title: { absolute: "Live shopping lige nu – brugt tøj og ting | SnupLive" },
  description:
    "Se hvem der er live lige nu. Find live-shows med vintagetøj, vinyl og retro design, og snup det, du kan lide, med ét tryk.",
  alternates: { canonical: "/live" },
};

export default async function LiveNu() {
  const { live, upcoming } = await fetchListing();
  return (
    <>
      <section className="phero" aria-labelledby="h-live">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Live nu</span>
          </nav>
          <span className="label red">
            <span className="live-dot" aria-hidden="true" style={{ marginRight: 8 }} />
            {live.length === 0 ? "Ingen er live lige nu" : live.length === 1 ? "1 sælger er live" : `${live.length} sælgere er live`}
          </span>
          <h1 className="h1" id="h-live">Live shopping lige nu</h1>
          <p className="lede">
            Hop ind i et show, kig med, og snup det, du kan lide. Alt, du snupper hos samme sælger i ét show, bliver
            samlet ét sted.
          </p>
        </div>
      </section>

      <section className="sec tight" aria-label="Shows, der er live">
        <div className="wrap">
          {live.length ? (
            <LiveGrid shows={live} />
          ) : (
            <div className="empty">
              <p style={{ marginBottom: 14 }}>
                Der er ingen live-shows lige nu.{upcoming.length ? " Se programmet herunder." : ""}
              </p>
              <Link className="btn btn-red" href="/studio">Gå live med dine ting</Link>
            </div>
          )}
        </div>
      </section>

      {upcoming.length ? (
        <section className="sec band" aria-labelledby="h-sched">
          <div className="wrap">
            <div className="sec-head">
              <span className="label">Programmet</span>
              <h2 className="h2" id="h-sched">Hvem går live senere?</h2>
              <p className="lede">Sælgerne planlægger deres shows på faste tidspunkter. Gem linket til sælgeren, og kig forbi, når showet starter.</p>
            </div>
            <div className="sched">
              {upcoming.map((s) => {
                const handle = s.seller?.handle ?? "sælger";
                const n = itemCount(s);
                return (
                  <div className="sched-row" key={s.id}>
                    <time dateTime={s.starts_at ?? undefined}>
                      <b>{s.starts_at ? clock(s.starts_at) : "–"}</b>
                      {s.starts_at ? dayLabel(s.starts_at) : ""}
                    </time>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={category(s.category).cover} alt="" loading="lazy" />
                    <div>
                      <h3>{s.title}</h3>
                      <span className="handle">
                        <Avatar handle={handle} />
                        {handle}
                        {n ? ` · ${n} ting` : ""}
                      </span>
                    </div>
                    <Link className="btn btn-line btn-sm remind" href={`/live/${handle}`}>Se showet</Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="sec" aria-labelledby="h-live-seo">
        <div className="wrap split" style={{ alignItems: "start" }}>
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <span className="label">Om live shopping</span>
            <h2 className="h2" id="h-live-seo">Hvad kan du købe live på SnupLive?</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="lede">
              På SnupLive går private sælgere og små genbrugsbutikker live med brugt tøj, vintage, vinyl, retro design,
              børnetøj og meget mere. Du ser tingene på video, før du køber, og kan bede sælgeren om at vise mål, mærker
              og stand tæt på.
            </p>
            <p className="lede">
              Når du snupper noget, lander det under Mine snup. Ved lanceringen betaler du samlet med MobilePay eller
              kort, og pengene bliver først udbetalt til sælgeren, når du har fået dine ting.
            </p>
            <div className="ctas">
              <Link className="btn btn-red" href="/opret">Opret gratis konto</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
