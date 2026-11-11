import type { Metadata } from "next";
import Link from "next/link";
import SortNote from "@/components/SortNote";
import EmptyNext from "@/components/EmptyNext";
import { IconLive } from "@/components/Icons";
import Avatar from "@/components/Avatar";
import RemindButton from "@/components/RemindButton";
import { clock, dayLabel, vareOrd } from "@/lib/format";
import { showImage } from "@/lib/images";
import { fetchListing, itemCount } from "@/lib/queries";
import LiveGrid from "./LiveGrid";

export const revalidate = 15;

export const metadata: Metadata = {
  title: { absolute: "Live shopping lige nu – second hand og gode fund | Relived" },
  description:
    "Se hvem der er live lige nu. Find live-shows med vintagetøj, vinyl og retro design, og køb det, du kan lide, med ét tryk.",
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
        </div>
      </section>

      <section className="sec tight" aria-label="Shows, der er live">
        <div className="wrap">
          {live.length ? (
            <>
              <LiveGrid shows={live} />
              <SortNote />
            </>
          ) : (
            upcoming.length ? (
              <div className="empty">
                <p style={{ marginBottom: 14 }}>Se, hvem der går live senere, og tryk Husk mig, så giver vi dig besked.</p>
                <a className="btn btn-ivory" href="#h-sched">Se programmet</a>
              </div>
            ) : (
              // Intet live og intet i programmet: tilmelding til nyhedsbrevet i stedet for en knap til en anden tom side.
              <EmptyNext
                title="Programmet er tomt lige nu"
                text="Skriv dig op, så får du besked, når de næste shows starter."
                icon={<IconLive />}
                source="nyhedsbrev-tom-live"
              >
                <div className="empty-more">
                  <Link className="btn btn-line btn-sm" href="/saadan-virker-det">Sådan virker live shopping</Link>
                  <Link className="btn btn-line btn-sm" href="/saelg">Sælg dine varer</Link>
                </div>
              </EmptyNext>
            )
          )}
        </div>
      </section>

      {upcoming.length ? (
        <section className="sec band" aria-labelledby="h-sched">
          <div className="wrap">
            <div className="sec-head">
              <h2 className="h2" id="h-sched">Hvem går live senere?</h2>
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
                    <img src={showImage(s)} alt="" loading="lazy" />
                    <div>
                      <h3>
                        <Link href={`/live/${handle}`}>{s.title}</Link>
                        {s.language === "en" ? (
                          <span className="b-lang" lang="en" title="Showet er på engelsk">
                            English
                          </span>
                        ) : null}
                      </h3>
                      <span className="handle">
                        <Avatar handle={handle} path={s.seller?.avatar_path} />
                        {handle}
                        {n ? ` · ${n} ${vareOrd(n)}` : ""}
                      </span>
                    </div>
                    <RemindButton showId={s.id} next="/live" className="btn btn-line btn-sm remind" />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

    </>
  );
}
