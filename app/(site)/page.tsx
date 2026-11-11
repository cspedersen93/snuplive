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
import { feeFreeCopy, feeFreeDay } from "@/lib/feeFree";
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
  title: { absolute: "Køb second hand live på video | Relived" },
  description:
    "Se varen på video, spørg sælgeren i chatten, og køb med ét tryk. Sælgeren får først pengene, når du har varen i hånden.",
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
  const free = await feeFreeCopy();
  const freeDay = free.active && free.until ? feeFreeDay(free.until) : null;
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
            free={Boolean(freeDay)}
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
              <li>Er varen ikke som vist, melder du et problem, og pengene venter.</li>
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

      <section className="sec band" aria-labelledby="h-video">
        <div className="wrap why">
          <div className="why-copy">
            <span className="label brass">Derfor live</span>
            <h2 className="h2" id="h-video">Billeder viser det pæne. <span>Video viser det hele.</span></h2>
            <p>
              Du kender det: fire billeder, en kort tekst og et håb om, at farven passer. På Relived holder sælgeren varen op til
              kameraet, vender den og viser dig lynlåsen, foret og det lille mærke på ærmet. Er du i tvivl, spørger du, og
              sælgeren svarer med det samme.
            </p>
            <Link className="btn btn-ivory" href="/til-salg">Se varer på video</Link>
          </div>
          <div className="why-vs" role="img" aria-label="Til venstre fire små billeder af en frakke, som i en annonce. Til højre sælgeren, der holder hele frakken frem live.">
            <figure className="why-ad">
              <div className="why-grid">
                <span style={{ backgroundPosition: "62% 40%" }} />
                <span style={{ backgroundPosition: "80% 66%" }} />
                <span style={{ backgroundPosition: "22% 74%" }} />
                <span style={{ backgroundPosition: "56% 84%" }} />
              </div>
              <figcaption><b>En annonce</b>Fire billeder, og resten gætter du</figcaption>
            </figure>
            <figure className="why-live">
              <div className="why-live-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/live-feed.jpg" alt="" loading="lazy" />
                <span className="hh-live"><span className="live-dot white" aria-hidden="true" />LIVE</span>
                <span className="why-q">Hvordan falder den i ryggen?</span>
              </div>
              <figcaption><b>På Relived</b>Hele varen, og du kan spørge</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {freeDay ? (
        <section className="sec" aria-labelledby="h-pris">
          <div className="wrap">
            <div className="price-card">
              <span className="label mint">Åbningskampagne</span>
              <h2 className="h2" id="h-pris">Hvad koster det? Lige nu 0 kr i gebyr</h2>
              <p>
                Vi er nye, og vi vil gerne have, at du prøver os. Derfor betaler hverken køber eller sælger gebyr i vores
                åbningskampagne. Du betaler varens pris og fragten, og du er lige så godt beskyttet som ellers.
              </p>
              <p className="price-fine">
                Kampagnen kører i seks måneder, til og med {freeDay}, og den kan slutte før tid. Derefter betaler køberen en
                køberbeskyttelse på 5 % af varerne + 5 kr pr. pakke. Det er stadig gratis at sælge.{" "}
                <Link href="/saadan-virker-det#priser">Se vilkår</Link>
              </p>
              <div className="ctas">
                <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
                <Link className="btn btn-line" href="/saelg">Sælg dine varer</Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
            <h2 className="h2" id="h-how" style={{ marginBottom: 24 }}>Hvordan køber jeg på Relived?</h2>
            <ol className="steps">
              <li><div><h3>Find et show eller en vare</h3><p>Se, hvem der er live, eller tryk Husk mig på et show, der starter senere. Så giver vi dig besked.</p></div></li>
              <li><div><h3>Se varen, og spørg løs</h3><p>Mål, stand, pasform og lugt af røg: spørg om det, billeder aldrig svarer på.</p></div></li>
              <li><div><h3>Køb med ét tryk</h3><p>Den første, der trykker Køb, får varen. På budsalg vinder det højeste bud.</p></div></li>
              <li><div><h3>Hent pakken, og sig god for den</h3><p>Sælgeren får først pengene, når du har fået varen og bekræftet, at alt er i orden.</p></div></li>
            </ol>
            <div className="ctas" style={{ marginTop: 28 }}>
              <Link className="btn btn-ivory" href="/live">Se hvem der er live</Link>
              <Link className="btn btn-line" href="/saadan-virker-det">Sådan virker det</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec tight" aria-labelledby="h-tryg">
        <div className="wrap">
          <div className="row-head">
            <h2 className="h2" id="h-tryg">Er det trygt at handle her?</h2>
            <Link className="btn btn-line" href="/saadan-virker-det#tryg-handel">Læs om tryg handel</Link>
          </div>
          <ul className="safe4">
            <li><h3>Pengene venter</h3><p>Vi holder betalingen tilbage, til du har varen.</p></li>
            <li><h3>Du ser, hvem du handler med</h3><p>Stjerner, niveau og om sælgeren er privat eller en virksomhed.</p></li>
            <li><h3>Mærkevarer bliver tjekket</h3><p>Luksusvarer til 1.000 kr eller mere skal ægthedstjekkes, før de kan sælges.</p></li>
            <li><h3>Vi hjælper, hvis noget går galt</h3><p>Tryk Meld et problem på ordren, så venter pengene, til sagen er afgjort.</p></li>
          </ul>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-saelg">
        <div className="wrap">
          <article className="panel img sell-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/sell-phone-v2.jpg" alt="En sælger viser en lædertaske frem til telefonen på stativet, med trøjer og et tøjstativ ved siden af" loading="lazy" />
            <span className="label red">Til sælgere</span>
            <h2 className="h2" id="h-saelg" style={{ maxWidth: "16ch" }}>Har du selv varer, der skal videre?</h2>
            <p style={{ maxWidth: 520, color: "rgba(246,240,235,.88)" }}>
              Tøm skabet på én aften i stedet for at lægge annoncer op én ad gangen. Du går live fra stuen med din telefon,
              viser varerne frem og svarer på spørgsmål undervejs. {inBeta() ? "Det er gratis at sælge, mens vi er i beta." : "Det er gratis at sælge."}
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
