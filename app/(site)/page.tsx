import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/og";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import CampaignCards from "@/components/CampaignCards";
import CategoryCards from "@/components/CategoryCards";
import { ItemTile, ShowTile } from "@/components/feed/FeedTiles";
import HomeHero from "@/components/feed/HomeHero";
import Program from "@/components/feed/Program";
import RailHello from "@/components/feed/RailHello";
import RailMine from "@/components/feed/RailMine";
import { IconPlay } from "@/components/Icons";
import ItemCard from "@/components/ItemCard";
import NewsletterForm from "@/components/NewsletterForm";
import RemindButton from "@/components/RemindButton";
import FreeNote from "@/components/FreeNote";
import ReuseCounter from "@/components/ReuseCounter";
import type { FeedItem, ShowWithSeller } from "@/lib/types";
import { campaignFlags } from "@/lib/campaignFlags";
import { campaignState } from "@/lib/campaigns";
import { inBeta, launched } from "@/lib/launch";
import { SITE_URL } from "@/lib/env";
import { clock, dayLabel } from "@/lib/format";
import { itemImage, showImage } from "@/lib/images";
import { DELIVERY } from "@/lib/pricing";
import { fetchFeed, fetchListing } from "@/lib/queries";
import { reusedCount } from "@/lib/reuse";

/** Små kort under det store kort og kasserne (12 går op i både 2, 3 og 4 kolonner). */
const FEED_TILES = 12;
type Tile = { kind: "show"; show: ShowWithSeller } | { kind: "item"; item: FeedItem };

export const revalidate = 30;

export const metadata: Metadata = {
  title: { absolute: "Køb og sælg second hand live på video | Relived" },
  description:
    "Køb second hand live: se tøjet, tasken eller lampen på video, spørg sælgeren i chatten, og køb med ét tryk. Sælgeren får først pengene, når du har varen.",
  openGraph: { title: "Second hand, du kan se live, før du køber", images: [OG_IMAGE] },
  alternates: { canonical: "/", languages: { "da-DK": "/", en: "/en" } },
};

export default async function Forside() {
  const [{ live, upcoming }, upcomingItems, auctions, forSale, flags, reused] = await Promise.all([
    fetchListing(12, 12),
    fetchFeed("upcoming", { limit: 20 }),
    fetchFeed("auctions", { limit: 12 }),
    fetchFeed("for_sale", { limit: 24 }),
    campaignFlags(),
    reusedCount(),
  ]);
  // Varer på budsalg har deres egen række, så de ikke står to gange.
  const soon = upcomingItems.filter((it) => it.sale_type !== "auction");

  // Feedet: det store kort med videoen (altid, også når nogen er live), så shows og varer blandet.
  // Hvem der er live, står i de runde billeder øverst og i de små kort.
  const tiles: Tile[] = [];
  for (const s of live.slice(0, 4)) tiles.push({ kind: "show", show: s });
  const nextShow = upcoming[0];
  if (nextShow && tiles.length < 4) tiles.push({ kind: "show", show: nextShow });
  // Varer uden billede står ikke i feedet (de ligner tomme felter), men stadig i rækkerne længere nede og i showet.
  const queues = [forSale, auctions, soon].map((q) => q.filter((it) => itemImage(it)));
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
  const soonShows = upcoming.slice(0, 4);
  const camp = campaignState(new Date(), flags);
  const campTitle =
    camp.gf.phase !== "over" && camp.jk.phase !== "over"
      ? "Vær med til Green Friday og julekalenderen"
      : camp.jk.phase !== "over"
        ? "Vær med til julekalenderen"
        : camp.gf.phase !== "over"
          ? "Vær med til Green Friday"
          : "Få ugens shows i din indbakke";

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
      {/* Forsiden: toppen, det store kort i fuld bredde, kasserne under det (på mobil efter kortene), så shows og varer. */}
      <div className="wrap home-feed">
        <div className="feed-top">
          <HomeHero
            liveCount={live.length}
            liveHref={live.length === 1 && live[0].seller?.handle ? `/live/${live[0].seller.handle}` : "/live"}
            nextCard={
              upcoming[0] ? (
                <>
                  <span className="label brass">
                    Næste show · {upcoming[0].starts_at ? `${dayLabel(upcoming[0].starts_at).toLowerCase()} kl. ${clock(upcoming[0].starts_at)}` : "tidspunkt kommer"}
                  </span>
                  <Link className="hh-next-t" href={`/live/${upcoming[0].seller?.handle ?? ""}`}>{upcoming[0].title}</Link>
                  <RemindButton showId={upcoming[0].id} next="/" className="btn btn-line btn-sm" />
                </>
              ) : null
            }
          >
            <FreeNote />
            <ReuseCounter n={reused} />
          </HomeHero>

          <nav className="feed-tabs" aria-label="Vis">
            <Link href="/" aria-current="page">For dig</Link>
            <Link href="/live">
              {live.length ? <span className="live-dot" aria-hidden="true" /> : null}
              Live nu
            </Link>
            <Link href="/budsalg">Budsalg</Link>
            <Link href="/til-salg">Til salg</Link>
            <Link href="/klip">Klip</Link>
          </nav>

          <Program live={live} upcoming={upcoming} />
        </div>

        {/* Det store videokort er væk: toppen (HomeHero) viser nu selv et show. */}
        <aside className="feed-rail" aria-label="Til dig">
          <RailMine />
          {/* Programmet står øverst på siden (components/feed/Program.tsx). Her står kun forklaringen, når det er tomt. */}
          {soonShows.length ? null : (
            // Tomt program: forklar, hvad der kommer til at stå her, og giv sælgerne en vej ind.
            <section className="rail-box" aria-labelledby="h-rail-snart">
              <div className="rail-top">
                <h2 className="rail-h" id="h-rail-snart">Snart live</h2>
                <Link className="rail-more" href="/live#h-sched">Program</Link>
              </div>
              <p className="rail-empty">
                Programmet er tomt lige nu. Når en sælger sætter et show i programmet, står det her, og du kan trykke Husk mig.
              </p>
              {/* Til sælgerne indtil lanceringen, til køberne bagefter. */}
              {launched() ? (
                <Link className="btn btn-line btn-sm" href="/nyhedsbrev">Få besked om nye shows</Link>
              ) : (
                <Link className="btn btn-line btn-sm" href="/saelg">Sæt dit eget show i programmet</Link>
              )}
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

        {tiles.length ? (
          <section className="feed-tiles" aria-label="Shows og varer">
            <div className="feed-grid">
              {tiles.map((t) =>
                t.kind === "show" ? <ShowTile key={`s${t.show.id}`} show={t.show} /> : <ItemTile key={`i${t.item.id}`} item={t.item} />,
              )}
            </div>
            <div className="feed-more">
              <Link className="btn btn-line" href="/til-salg">Se alt til salg</Link>
              <Link className="btn btn-line" href="/live">Se hvem der går live</Link>
            </div>
          </section>
        ) : null}

        {/* Nyhedsbrev med reklame for de næste kampagner (slås til i Backoffice → Nyhedsbrev). Kortene forsvinder,
            når kampagnerne er slut. */}
        {flags.home ? (
          <section className="camp" aria-labelledby="h-camp">
            <div className="camp-head">
              <span className="label red">Nyhedsbrev</span>
              <h2 className="camp-h" id="h-camp">{campTitle}</h2>
              <p>
                {camp.active
                  ? "Skriv dig op, så sender vi en mail, før showene starter."
                  : "Skriv dig op, så sender vi ugens shows og de bedste fund."}
              </p>
            </div>
            <CampaignCards flags={flags} sellerLink />
            <NewsletterForm source="nyhedsbrev-forside" />
          </section>
        ) : null}
      </div>

      <ItemRow id="budsalg" title="Kommende budsalg – byd med live" items={auctions} link={{ href: "/budsalg", label: "Se alle budsalg" }} />
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
            <img src="/img/how-live-v2.jpg" alt="En sælger viser en brun lædertaske frem til telefonen foran ringlyset" loading="lazy" width={1360} height={768} />
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
              <Link className="btn btn-ivory" href="/live">Find et show</Link>
              <Link className="btn btn-line" href="/saadan-virker-det">Sådan virker det</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-saelg">
        <div className="wrap">
          <article className="panel img sell-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/sell-phone-v2.jpg" alt="En sælger viser en lædertaske frem til telefonen på stativet, med trøjer og et tøjstativ ved siden af" loading="lazy" />
            <span className="label red">Til sælgere</span>
            <h2 className="h2" id="h-saelg" style={{ maxWidth: "16ch" }}>Har du selv noget, der skal videre?</h2>
            <p style={{ maxWidth: 520, color: "rgba(246,240,235,.88)" }}>
              Sælg brugte fund, ubrugte fejlkøb og nye restpartier live. Gå live fra stuen eller butikken, og sælg en hel bunke på
              én aften i stedet for at lægge annoncer op én ad gangen. {inBeta() ? "Det er gratis at sælge, mens vi er i beta." : "Det er gratis at sælge."}
            </p>
            <Link className="btn btn-ivory" href="/saelg">Sådan sælger du live</Link>
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
              <Link className="btn btn-line" href={extra.href}>
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
