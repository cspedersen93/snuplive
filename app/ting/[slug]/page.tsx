import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import Avatar from "@/components/Avatar";
import { IconBell } from "@/components/Icons";
import ItemCard from "@/components/ItemCard";
import RemindButton from "@/components/RemindButton";
import { itemMeta } from "@/components/Screen";
import SetupNotice from "@/components/SetupNotice";
import { SITE_URL } from "@/lib/env";
import { category, clock, dayLabel, gradFor, kr } from "@/lib/format";
import { itemImages } from "@/lib/images";
import { idFromSlug, itemHref, itemSlug, itemState, type ItemState } from "@/lib/items";
import { isAuction, soldPrice } from "@/lib/auction";
import { DELIVERY } from "@/lib/pricing";
import { fetchFeed } from "@/lib/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { ITEM_COLS, type Item } from "@/lib/types";
import BuyNow from "./BuyNow";
import Gallery from "./Gallery";

export const revalidate = 30;

type Params = { params: Promise<{ slug: string }> };

interface Loaded extends Item {
  show: { id: string; title: string; status: "planned" | "live" | "ended"; starts_at: string | null; category: string } | null;
  seller: { handle: string; display_name: string | null; area: string | null; avatar_path: string | null } | null;
}

const load = cache(async (slug: string) => {
  const sb = createPublicClient();
  if (!sb) return { setup: false as const };
  const id = idFromSlug(decodeURIComponent(slug));
  if (!id) return { setup: true as const, item: null };
  const { data } = await sb
    .from("items")
    .select(
      `${ITEM_COLS},show:shows!items_show_id_fkey(id,title,status,starts_at,category),seller:profiles!items_seller_id_fkey(handle,display_name,area,avatar_path)`,
    )
    .eq("id", id)
    .maybeSingle();
  const item = data as unknown as Loaded | null;
  if (!item?.show || !item.seller) return { setup: true as const, item: null };
  return { setup: true as const, item };
});

function stateOf(it: Loaded): ItemState {
  return itemState({ status: it.status, for_sale: it.for_sale, show_status: it.show?.status ?? "ended" });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d.setup || !d.item) return { title: "Tingen findes ikke", robots: { index: false } };
  const it = d.item;
  const cat = category(it.category ?? it.show?.category);
  const state = stateOf(it);
  const meta = itemMeta(it);
  const bid = isAuction(it) && (state === "upcoming" || state === "live" || state === "showing");
  const where =
    state === "for_sale"
      ? "Køb den nu til fast pris"
      : state === "upcoming" && it.show?.starts_at
        ? `${bid ? "På budsalg" : "Vises"} live ${dayLabel(it.show.starts_at).toLowerCase()} kl. ${clock(it.show.starts_at)}`
        : state === "live" || state === "showing"
          ? bid
            ? "Budsalg live nu"
            : "Sælgeren er live nu"
          : "Se lignende ting";
  const title = `${it.name} – brugt ${cat.word}, ${kr(it.price)}`;
  const images = itemImages(it);
  return {
    title: title.length <= 48 ? title : it.name.slice(0, 48),
    description: `${it.name}${meta ? ` (${meta})` : ""} ${bid ? "fra" : "til"} ${kr(it.price)} hos ${it.seller?.handle}. ${where}. Beskyttet betaling på SnupLive.`.slice(0, 155),
    alternates: { canonical: itemHref(it) },
    // Solgte og fjernede ting skal ikke ligge i Google.
    robots: state === "sold" || state === "off" ? { index: false, follow: true } : undefined,
    openGraph: images.length ? { images: [{ url: images[0], width: 1080, height: 1350, alt: it.name }] } : undefined,
  };
}

export default async function ItemPage({ params }: Params) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d.setup) return <SetupNotice />;
  const it = d.item;
  if (!it || !it.show || !it.seller) notFound();
  if (decodeURIComponent(slug) !== itemSlug(it)) permanentRedirect(itemHref(it));

  const show = it.show;
  const seller = it.seller;
  const cat = category(it.category ?? show.category);
  const state = stateOf(it);
  const images = itemImages(it);
  const meta = itemMeta(it);
  const href = itemHref(it);
  const liveHref = `/live/${seller.handle}`;
  // Budsalg før og under showet. Efter showet er en usolgt ting til salg til startprisen som alle andre.
  const bid = isAuction(it) && (state === "upcoming" || state === "live" || state === "showing");

  const [fromSeller, similar] = await Promise.all([
    fetchFeed(state === "upcoming" ? "upcoming" : "for_sale", { seller: it.seller_id, exclude: it.id, limit: 5 }),
    fetchFeed("for_sale", { category: cat.key, exclude: it.id, limit: 10 }),
  ]);
  const similarOther = similar.filter((x) => x.seller_id !== it.seller_id).slice(0, 5);

  const availability =
    state === "for_sale" || state === "live" || state === "showing"
      ? "https://schema.org/InStock"
      : state === "upcoming"
        ? "https://schema.org/PreOrder"
        : state === "sold"
          ? "https://schema.org/SoldOut"
          : "https://schema.org/Discontinued";
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: it.name,
        description: it.description || `${it.name}${meta ? `, ${meta}` : ""}. Brugt ${cat.word} fra ${seller.handle} på SnupLive.`,
        ...(images.length ? { image: images } : {}),
        category: cat.label,
        itemCondition: "https://schema.org/UsedCondition",
        offers: {
          "@type": "Offer",
          url: `${SITE_URL}${href}`,
          price: it.price,
          priceCurrency: "DKK",
          availability,
          itemCondition: "https://schema.org/UsedCondition",
          seller: { "@type": "Person", name: seller.handle },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Forside", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: cat.label, item: `${SITE_URL}/kategori/${cat.slug}` },
          { "@type": "ListItem", position: 3, name: it.name, item: `${SITE_URL}${href}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="wrap item-page">
        <nav className="crumbs" aria-label="Brødkrummer">
          <Link href="/">Forside</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/kategori/${cat.slug}`}>{cat.label}</Link>
          <span aria-hidden="true">/</span>
          <span>{it.name}</span>
        </nav>

        <div className="item-grid">
          {images.length ? (
            <Gallery images={images} alt={it.name} />
          ) : (
            <div className="gallery">
              <div className="gallery-main gallery-empty" style={{ background: gradFor(it.id) }}>
                <span>{it.name}</span>
              </div>
            </div>
          )}

          <div className="item-info">
            <div className="item-head">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {bid ? <span className="chip bid">Budsalg</span> : null}
                <StateChip state={state} startsAt={show.starts_at} />
              </div>
              <h1 className="item-h1">{it.name}</h1>
              <p className="item-price num">
                {bid ? (
                  it.high_bid ? (
                    <>
                      <span className="muted item-price-k">Højeste bud</span> {kr(it.high_bid)}
                    </>
                  ) : (
                    <>
                      <span className="muted item-price-k">Startpris</span> {kr(it.price)}
                    </>
                  )
                ) : (
                  kr(state === "sold" ? soldPrice(it) : it.price)
                )}
              </p>
              {meta ? <p className="muted">{meta}</p> : null}
            </div>

            <div className="box item-cta">
              {state === "for_sale" ? (
                <>
                  {isAuction(it) ? <p>Ingen bød på den i showet, så nu kan du købe den til startprisen.</p> : null}
                  <BuyNow itemId={it.id} price={it.price} next={href} sellerId={it.seller_id} />
                  <p className="fine">
                    Tingen bliver reserveret til dig, og du betaler under Mine snup. Fragt {DELIVERY.ship.price} kr til pakkeshop, eller
                    hent den gratis hos sælgeren.
                  </p>
                </>
              ) : state === "upcoming" && bid ? (
                <>
                  <p>
                    Den kommer på budsalg live{" "}
                    {show.starts_at ? `${dayLabel(show.starts_at).toLowerCase()} kl. ${clock(show.starts_at)}` : "snart"} i{" "}
                    <Link href={liveHref}>{show.title}</Link>. Buddene starter ved {kr(it.price)}, og det højeste bud vinder.
                  </p>
                  <RemindButton showId={show.id} itemId={it.id} next={href} className="btn btn-red btn-block" />
                  <p className="fine">Vi sender dig en mail, når showet starter. Du forpligter dig ikke til at byde.</p>
                </>
              ) : state === "upcoming" ? (
                <>
                  <p>
                    Den bliver vist live {show.starts_at ? `${dayLabel(show.starts_at).toLowerCase()} kl. ${clock(show.starts_at)}` : "snart"} i{" "}
                    <Link href={liveHref}>{show.title}</Link>. Du kan snuppe den, mens den bliver vist.
                  </p>
                  <RemindButton showId={show.id} itemId={it.id} next={href} className="btn btn-red btn-block" />
                  <p className="fine">Vi sender dig en mail, når showet starter. Du forpligter dig ikke til at købe.</p>
                </>
              ) : state === "live" || state === "showing" ? (
                <>
                  <p>
                    {state === "showing" && bid ? (
                      <>
                        <b>Budsalget er i gang.</b> Gå ind i showet og byd, før tiden løber ud.
                      </>
                    ) : state === "showing" ? (
                      <>
                        <b>Den bliver vist lige nu.</b> Gå ind i showet og snup den.
                      </>
                    ) : bid ? (
                      <>
                        <b>{seller.handle} er live nu.</b> Budsalget starter, når tingen bliver vist.
                      </>
                    ) : (
                      <>
                        <b>{seller.handle} er live nu.</b> Tingen er i køen. Gå ind i showet og snup den, når den bliver vist.
                      </>
                    )}
                  </p>
                  <Link className="btn btn-red btn-block" href={liveHref}>
                    <span className="live-dot white" aria-hidden="true" />
                    {bid ? "Se med og byd" : "Se med og snup"}
                  </Link>
                </>
              ) : state === "sold" ? (
                <>
                  <p>
                    <b>{isAuction(it) && it.high_bid ? `Den blev solgt på budsalg for ${kr(it.high_bid)}.` : "Den er solgt."}</b> Se om der er
                    noget lignende i kategorien, eller kig forbi, når {seller.handle} går live igen.
                  </p>
                  <Link className="btn btn-line btn-block" href={`/kategori/${cat.slug}`}>
                    Se mere {cat.word}
                  </Link>
                </>
              ) : (
                <>
                  <p>Tingen er ikke til salg lige nu. Sælgeren viser den måske i et kommende show.</p>
                  <Link className="btn btn-line btn-block" href={liveHref}>
                    Se {seller.handle}s shows
                  </Link>
                </>
              )}
            </div>

            {it.description ? (
              <section aria-labelledby="h-beskrivelse">
                <h2 className="h3" id="h-beskrivelse" style={{ marginBottom: 8 }}>Beskrivelse</h2>
                <p className="item-desc">{it.description}</p>
              </section>
            ) : null}

            <Link className="seller-row item-seller" href={liveHref}>
              <Avatar handle={seller.handle} path={seller.avatar_path} size={46} />
              <span>
                <strong>{seller.handle}</strong>
                <span className="muted" style={{ fontSize: ".88rem" }}>
                  {[seller.area, show.status === "ended" ? `Fra showet ${show.title}` : show.title].filter(Boolean).join(" · ")}
                </span>
              </span>
            </Link>

            <ul className="item-trust">
              <li>Betalingen er beskyttet. Sælgeren får først pengene, når du har tingen.</li>
              <li>Fragt {DELIVERY.ship.price} kr med DAO eller GLS, eller gratis afhentning.</li>
              <li>Køber du flere ting fra {seller.handle}, får du dem i én pakke.</li>
            </ul>
          </div>
        </div>

        {fromSeller.length ? (
          <section className="item-more" aria-labelledby="h-fra-saelger">
            <div className="row-head">
              <h2 className="h3" id="h-fra-saelger">
                {state === "upcoming" ? `Også i showet hos ${seller.handle}` : `Mere fra ${seller.handle}`}
              </h2>
              <Link className="linkbtn" href={liveHref}>Se sælgeren</Link>
            </div>
            <div className="icards">
              {fromSeller.map((x) => (
                <ItemCard key={x.id} item={x} />
              ))}
            </div>
          </section>
        ) : null}

        {similarOther.length ? (
          <section className="item-more" aria-labelledby="h-lignende">
            <div className="row-head">
              <h2 className="h3" id="h-lignende">Mere {cat.word} til salg</h2>
              <Link className="linkbtn" href={`/kategori/${cat.slug}`}>Se hele kategorien</Link>
            </div>
            <div className="icards">
              {similarOther.map((x) => (
                <ItemCard key={x.id} item={x} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

function StateChip({ state, startsAt }: { state: ItemState; startsAt: string | null }) {
  if (state === "for_sale") return <span className="chip ok">Køb nu</span>;
  if (state === "live" || state === "showing")
    return (
      <span className="chip live">
        <span className="live-dot white" aria-hidden="true" />
        Live nu
      </span>
    );
  if (state === "upcoming")
    return (
      <span className="chip">
        <IconBell width={14} height={14} />
        {startsAt ? `Live ${dayLabel(startsAt).toLowerCase()} kl. ${clock(startsAt)}` : "Kommer live"}
      </span>
    );
  if (state === "sold") return <span className="chip sold">Solgt</span>;
  return <span className="chip sold">Ikke til salg</span>;
}
