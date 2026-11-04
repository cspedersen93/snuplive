import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import CategoryCards from "@/components/CategoryCards";
import { BigShowTile, ItemTile, ShowTile, WelcomeTile } from "@/components/feed/FeedTiles";
import RailHello from "@/components/feed/RailHello";
import RailMine from "@/components/feed/RailMine";
import { IconPlay } from "@/components/Icons";
import ItemCard from "@/components/ItemCard";
import RemindButton from "@/components/RemindButton";
import type { FeedItem, ShowWithSeller } from "@/lib/types";
import { SITE_URL } from "@/lib/env";
import { clock, dayLabel } from "@/lib/format";
import { showImage } from "@/lib/images";
import { DELIVERY } from "@/lib/pricing";
import { fetchFeed, fetchListing } from "@/lib/queries";

/** Små kort i feedet ud over det store (12 går op i både 2, 3 og 4 kolonner med det store kort på 2×2). */
const FEED_TILES = 12;
type Tile = { kind: "show"; show: ShowWithSeller } | { kind: "item"; item: FeedItem };

/** Én sælger én gang i rækken med runde billeder (live først, så dem der starter snart). */
function uniqueBySeller(shows: ShowWithSeller[]) {
  const seen = new Set<string>();
  return shows.filter((s) => (seen.has(s.seller_id) ? false : (seen.add(s.seller_id), true)));
}

export const revalidate = 30;

export const metadata: Metadata = {
  title: { absolute: "Køb og sælg second hand live på video | Relived" },
  description:
    "Køb second hand live: se tøjet, tasken eller lampen på video, spørg sælgeren i chatten, og køb med ét tryk. Sælgeren får først pengene, når du har varen.",
  openGraph: { title: "Second hand, du kan se live, før du køber" },
  alternates: { canonical: "/", languages: { "da-DK": "/", en: "/en" } },
};

export default async function Forside() {
  const [{ live, upcoming }, upcomingItems, auctions, forSale] = await Promise.all([
    fetchListing(12, 12),
    fetchFeed("upcoming", { limit: 20 }),
    fetchFeed("auctions", { limit: 12 }),
    fetchFeed("for_sale", { limit: 24 }),
  ]);
  // Varer på budsalg har deres egen række, så de ikke står to gange.
  const soon = upcomingItems.filter((it) => it.sale_type !== "auction");

  // Feedet: det store kort (live nu, ellers det næste show), så shows og varer blandet.
  const big = live[0] ?? upcoming[0] ?? null;
  const tiles: Tile[] = [];
  for (const s of live.slice(big?.status === "live" ? 1 : 0, 4)) tiles.push({ kind: "show", show: s });
  const nextShow = upcoming.find((s) => s.id !== big?.id);
  if (nextShow && tiles.length < 4) tiles.push({ kind: "show", show: nextShow });
  const queues = [forSale, auctions, soon].map((q) => [...q]);
  const usedSale = new Set<string>();
  while (tiles.length < FEED_TILES && queues.some((q) => q.length)) {
    for (const q of queues) {
      const it = q.shift();
      if (!it || tiles.length >= FEED_TILES) continue;
      if (tiles.some((t) => t.kind === "item" && t.item.id === it.id)) continue;
      tiles.push({ kind: "item", item: it });
      if (q === queues[0]) usedSale.add(it.id);
    }
  }
  const moreForSale = forSale.filter((it) => !usedSale.has(it.id)).slice(0, 10);
  const soonShows = upcoming.filter((s) => s.id !== big?.id).slice(0, 4);
  const stories = uniqueBySeller([...live, ...upcoming]).slice(0, 12);

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "Relived", url: `${SITE_URL}/`, logo: `${SITE_URL}/img/logo.png` },
      { "@type": "WebSite", name: "Relived", url: `${SITE_URL}/`, inLanguage: "da-DK" },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="wrap home-feed">
        <div className="feed-main">
          <div className="feed-head">
            <span className="label red feed-eyebrow">
              {live.length ? <span className="live-dot" aria-hidden="true" /> : null}
              {live.length ? `${live.length} ${live.length === 1 ? "sælger er" : "sælgere er"} live nu` : "Live Sale. Second Hand."}
            </span>
            <h1 id="h-forside" className="feed-h1">
              Second hand, du kan se <em className="s">live</em>, før du køber
            </h1>
            <p className="feed-lede">Brugt, som ny eller med prismærket på. Se varen på video, spørg sælgeren i chatten, og køb med ét tryk.</p>
          </div>

          <nav className="feed-tabs" aria-label="Vis">
            <Link href="/" aria-current="page">For dig</Link>
            <Link href="/live">
              {live.length ? <span className="live-dot" aria-hidden="true" /> : null}
              Live nu
            </Link>
            {auctions.length ? <Link href="#budsalg">Budsalg</Link> : null}
            <Link href="/til-salg">Til salg</Link>
            <Link href="/klip">Klip</Link>
          </nav>

          {stories.length ? (
            <div className="stories" role="list" aria-label="Sælgere, der er live eller går live snart">
              {stories.map((s) => {
                const handle = s.seller?.handle ?? "sælger";
                const on = s.status === "live";
                return (
                  <Link key={s.id} role="listitem" className={`story${on ? " on" : ""}`} href={`/live/${handle}`}>
                    <span className="story-ring">
                      <Avatar handle={handle} path={s.seller?.avatar_path} />
                      {on ? <span className="story-tag">Live</span> : null}
                    </span>
                    <span className="story-name">{handle}</span>
                    {!on && s.starts_at ? <span className="story-time">{clock(s.starts_at)}</span> : null}
                  </Link>
                );
              })}
            </div>
          ) : null}

          <section aria-labelledby="h-feed">
            <h2 className="sr-only" id="h-feed">Hvem er live, og hvad er til salg lige nu?</h2>
            {/* Med få kort (fx i starten, når ingen er live) bliver det store kort et banner i fuld bredde, så der ikke står
                et tomt felt ved siden af det. */}
            <div className={`feed-grid${tiles.length < 4 ? " sparse" : ""}`}>
              {big ? <BigShowTile show={big} /> : <WelcomeTile hasItems={forSale.length > 0} />}
              {tiles.map((t) =>
                t.kind === "show" ? <ShowTile key={`s${t.show.id}`} show={t.show} /> : <ItemTile key={`i${t.item.id}`} item={t.item} />,
              )}
            </div>
            {/* Knapperne under kortene kun, når der er kort. Står det store kort alene, har det sine egne knapper. */}
            {tiles.length ? (
              <div className="feed-more">
                <Link className="btn btn-line" href="/til-salg">Se alt til salg</Link>
                <Link className="btn btn-line" href="/live">Se hvem der går live</Link>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="feed-rail" aria-label="Til dig">
          <RailMine />
          {soonShows.length ? (
            <section className="rail-box" aria-labelledby="h-rail-snart">
              <div className="rail-top">
                <h2 className="rail-h" id="h-rail-snart">Snart live</h2>
                <Link className="rail-more" href="/live#h-sched">Program</Link>
              </div>
              <ul className="rail-list">
                {soonShows.map((s) => {
                  const handle = s.seller?.handle ?? "sælger";
                  return (
                    <li key={s.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={showImage(s)} alt="" loading="lazy" />
                      <span className="rail-txt">
                        {s.starts_at ? <span className="rail-when">{dayLabel(s.starts_at)} {clock(s.starts_at)}</span> : null}
                        <strong>
                          <Link href={`/live/${handle}`}>{s.title}</Link>
                        </strong>
                        <span>{handle}</span>
                        <RemindButton showId={s.id} next="/" className="btn btn-line btn-sm rail-remind" />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            // Tomt program: forklar, hvad der kommer til at stå her, og giv sælgerne en vej ind.
            <section className="rail-box" aria-labelledby="h-rail-snart">
              <div className="rail-top">
                <h2 className="rail-h" id="h-rail-snart">Snart live</h2>
                <Link className="rail-more" href="/live#h-sched">Program</Link>
              </div>
              <p className="rail-empty">
                Programmet er tomt lige nu. Når en sælger sætter et show i programmet, står det her, og du kan trykke Husk mig.
              </p>
              <Link className="btn btn-line btn-sm" href="/saelg">Sæt dit eget show i programmet</Link>
            </section>
          )}
          <RailHello />
          <section className="rail-box" aria-labelledby="h-rail-tryg">
            <h2 className="rail-h" id="h-rail-tryg">Tryg handel</h2>
            <ul className="rail-checks">
              <li>Sælgeren får først pengene, når du har varen.</li>
              <li>Alt fra samme sælger i én pakke, fra {DELIVERY.ship.price} kr til pakkeshop.</li>
              <li>14 dages fortrydelsesret, når du køber på afstand.</li>
            </ul>
            <Link className="rail-link" href="/saadan-virker-det#priser">Priser, fragt og rabat</Link>
          </section>
        </aside>
      </div>

      <ItemRow id="budsalg" title="Kommende budsalg – byd med live" items={auctions} link={{ href: "/live", label: "Se programmet" }} />
      <ItemRow
        id="h-til-salg"
        title="Til salg nu – køb til fast pris"
        items={moreForSale}
        link={{ href: "/til-salg", label: "Se alt til salg" }}
        extra={moreForSale.some((i) => i.clip_path) ? { href: "/klip", label: "Swipe gennem klip" } : undefined}
      />

      <section className="sec tight" aria-labelledby="h-kategorier">
        <div className="wrap">
          <div className="row-head">
            <h2 className="h2" id="h-kategorier">Hvad kan du købe brugt på Relived?</h2>
            <Link className="btn btn-line" href="/kategori">Alle kategorier</Link>
          </div>
          <CategoryCards />
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-how">
        <div className="wrap split">
          <figure className="photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/how-live.jpg" alt="En sælger viser en brun lædertaske frem til telefonen foran ringlyset" loading="lazy" width={1360} height={768} />
            <figcaption>
              <span className="live-dot" aria-hidden="true" />
              Live fra stuen
            </figcaption>
          </figure>
          <div>
            <h2 className="h2" id="h-how" style={{ marginBottom: 24 }}>Hvordan køber man brugt live?</h2>
            <ol className="steps">
              <li><div><h3>Find et show eller en vare</h3><p>Se, hvem der er live, eller tryk Husk mig på et show, der starter senere. Så giver vi dig besked.</p></div></li>
              <li><div><h3>Se den tæt på, og spørg</h3><p>Bed sælgeren vise mærket, målene og slid tæt på. Du får svar, mens du ser med.</p></div></li>
              <li><div><h3>Køb eller byd</h3><p>Tryk Køb, eller byd med på budsalg. Du betaler samlet bagefter, og alt fra samme sælger kommer i én pakke.</p></div></li>
            </ol>
            <div className="ctas" style={{ marginTop: 28 }}>
              <Link className="btn btn-red" href="/live">Find et show</Link>
              <Link className="btn btn-line" href="/saadan-virker-det">Sådan virker det</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-saelg">
        <div className="wrap">
          <article className="panel img sell-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/sell-phone.jpg" alt="En sælger viser en lædertaske frem til telefonen på stativet, med trøjer og et tøjstativ ved siden af" loading="lazy" />
            <span className="label red">Til sælgere</span>
            <h2 className="h2" id="h-saelg" style={{ maxWidth: "16ch" }}>Har du selv noget, der skal videre?</h2>
            <p style={{ maxWidth: 520, color: "rgba(246,240,235,.88)" }}>
              Sælg brugte fund, ubrugte fejlkøb og nye restpartier live. Gå live fra stuen eller butikken, og sælg en hel bunke på
              én aften i stedet for at lægge annoncer op én ad gangen. Det er gratis at sælge, mens vi er i beta.
            </p>
            <Link className="btn btn-red" href="/saelg">Sådan sælger du live</Link>
          </article>
        </div>
      </section>
    </>
  );
}

/** En vandret række med ting (forsiden). Vises ikke, når der ikke er noget. */
function ItemRow({
  id,
  title,
  items,
  link,
  extra,
}: {
  id: string;
  title: string;
  items: FeedItem[];
  link: { href: string; label: string };
  extra?: { href: string; label: string };
}) {
  if (!items.length) return null;
  return (
    <section className="sec tight" aria-labelledby={id}>
      <div className="wrap">
        <div className="row-head">
          <h2 className="h2" id={id}>{title}</h2>
          {extra ? (
            <div className="row-head-btns">
              <Link className="btn btn-red" href={extra.href}>
                <IconPlay width={14} height={14} />
                {extra.label}
              </Link>
              <Link className="btn btn-line" href={link.href}>{link.label}</Link>
            </div>
          ) : (
            <Link className="btn btn-line" href={link.href}>{link.label}</Link>
          )}
        </div>
        <div className="icards-scroll" style={{ "--n": items.length } as React.CSSProperties}>
          <div className="icards">
            {items.map((it) => (
              <ItemCard key={it.id} item={it} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
