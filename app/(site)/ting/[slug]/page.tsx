import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import Avatar from "@/components/Avatar";
import { IconBell } from "@/components/Icons";
import ItemCard from "@/components/ItemCard";
import NoPhoto from "@/components/NoPhoto";
import RemindButton from "@/components/RemindButton";
import ReportButton from "@/components/ReportButton";
import { itemMeta } from "@/components/Screen";
import SellerFacts from "@/components/SellerFacts";
import SetupNotice from "@/components/SetupNotice";
import { SITE_URL } from "@/lib/env";
import { category, clock, dayLabel, kr, usedPhrase } from "@/lib/format";
import { clipUrl, itemImages } from "@/lib/images";
import { idFromSlug, itemHref, itemSlug, itemState, type ItemState } from "@/lib/items";
import { isAuction, soldPrice } from "@/lib/auction";
import { DELIVERY } from "@/lib/pricing";
import { fetchFeed } from "@/lib/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { ITEM_COLS, SELLER_FACT_COLS, type Item, type SellerFactsData } from "@/lib/types";
import BuyNow from "./BuyNow";
import FollowButton from "@/components/FollowButton";
import { IconShieldCheck } from "@/components/Icons";
import Gallery from "./Gallery";

export const revalidate = 30;

type Params = { params: Promise<{ slug: string }> };

interface Loaded extends Item {
  show: { id: string; title: string; status: "planned" | "live" | "ended"; starts_at: string | null; category: string; removed_at: string | null } | null;
  seller: ({ handle: string; display_name: string | null; area: string | null; avatar_path: string | null } & SellerFactsData) | null;
}

const load = cache(async (slug: string) => {
  const sb = createPublicClient();
  if (!sb) return { setup: false as const };
  const id = idFromSlug(decodeURIComponent(slug));
  if (!id) return { setup: true as const, item: null };
  const [{ data }, clipRes, authRes, kindRes] = await Promise.all([
    sb
      .from("items")
      .select(
        `${ITEM_COLS},show:shows!items_show_id_fkey(id,title,status,starts_at,category,removed_at),seller:profiles!items_seller_id_fkey(handle,display_name,area,avatar_path,${SELLER_FACT_COLS})`,
      )
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle(),
    // Klippet hentes for sig, så siden virker, også før 0015_klip.sql er kørt.
    sb.from("items").select("clip_path,clip_at").eq("id", id).maybeSingle(),
    // Ægthedstjek (0017_aegthed.sql).
    sb.from("items").select("auth_required,auth_status").eq("id", id).maybeSingle(),
    // Videoannonce (0019_videoannoncer.sql)?
    sb.from("items").select("show:shows!items_show_id_fkey(kind)").eq("id", id).maybeSingle(),
  ]);
  const item = data as unknown as Loaded | null;
  // En ting eller et show, der er fjernet efter en anmeldelse, findes ikke længere.
  if (!item?.show || !item.seller || item.show.removed_at) return { setup: true as const, item: null };
  const clip = clipRes.error ? null : (clipRes.data as { clip_path: string | null; clip_at: string | null } | null);
  const a = authRes.error ? null : (authRes.data as { auth_required: boolean; auth_status: string | null } | null);
  const auth = a?.auth_required ? (a.auth_status === "approved" ? ("approved" as const) : ("waiting" as const)) : null;
  const video = !kindRes.error && (kindRes.data as unknown as { show: { kind: string } | null } | null)?.show?.kind === "video";
  return { setup: true as const, item, clip: clip?.clip_path ? { url: clipUrl(clip) as string, at: clip.clip_at } : null, auth, video };
});

function stateOf(it: Loaded): ItemState {
  return itemState({ status: it.status, for_sale: it.for_sale, show_status: it.show?.status ?? "ended" });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d.setup || !d.item) return { title: "Varen findes ikke", robots: { index: false } };
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
          : "Se lignende varer";
  const title = `${it.name} – ${usedPhrase(cat)}, ${kr(it.price)}`;
  const images = itemImages(it);
  return {
    title: title.length <= 48 ? title : it.name.slice(0, 48),
    description: `${it.name}${meta ? ` (${meta})` : ""} ${bid ? "fra" : "til"} ${kr(it.price)} hos ${it.seller?.handle}. ${where}. Beskyttet betaling på Relived.`.slice(0, 155),
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
  // "mere dametøj", men "flere designervarer" og "flere varer" (Andet).
  const more = cat.key === "andet" ? "flere varer" : /er$/.test(cat.word) ? `flere ${cat.word}` : `mere ${cat.word}`;
  const state = stateOf(it);
  const images = itemImages(it);
  // Klippet fra live-showet vises, når tingen er til salg bagefter (eller solgt, til klippet bliver slettet).
  const clip = state === "for_sale" || state === "sold" ? d.clip : null;
  const video = clip?.url ?? null;
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
        description: it.description || `${it.name}${meta ? `, ${meta}` : ""}. ${usedPhrase(cat).replace(/^./, (c) => c.toUpperCase())} fra ${seller.handle} på Relived.`,
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
      // Klippet fra live-showet, så Google kan vise tingen med video.
      ...(clip && images.length
        ? [
            {
              "@type": "VideoObject",
              name: d.video ? `${it.name} på video` : `${it.name} vist live`,
              description: `${it.name}${meta ? `, ${meta}` : ""}, ${d.video ? "filmet" : "vist live"} af ${seller.handle} på Relived.`,
              thumbnailUrl: images[0],
              contentUrl: clip.url,
              uploadDate: clip.at ?? undefined,
            },
          ]
        : []),
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
          {images.length || video ? (
            <Gallery images={images} alt={it.name} video={video} filmed={d.video} />
          ) : (
            <div className="gallery">
              <div className="gallery-main gallery-empty">
                <NoPhoto cat={cat.key} size="large" text={state === "upcoming" || state === "live" ? "Sælgeren viser den live" : "Intet billede endnu"} />
              </div>
            </div>
          )}

          <div className="item-info">
            <div className="item-head">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {bid ? <span className="chip bid">Budsalg</span> : null}
                {d.auth === "waiting" && state === "for_sale" ? (
                  <span className="chip warn">Venter på tjek</span>
                ) : (
                  <StateChip state={state} startsAt={show.starts_at} />
                )}
                {d.auth === "approved" ? (
                  <span className="chip auth" title="Relived har tjekket billeder af logo, koder og syninger">
                    <IconShieldCheck />
                    Ægthed tjekket
                  </span>
                ) : null}
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
              {d.auth === "waiting" && state !== "sold" ? (
                <p className="auth-wait">
                  <b>Venter på ægthedstjek.</b> Det er en mærkevare, så Relived tjekker, at den er ægte, før den kan købes. Følg sælgeren, så
                  får du besked, når den bliver vist live.
                </p>
              ) : state === "for_sale" ? (
                <>
                  {isAuction(it) ? <p>Ingen bød på den i showet, så nu kan du købe den til startprisen.</p> : null}
                  <BuyNow itemId={it.id} price={it.price} next={href} sellerId={it.seller_id} />
                  <p className="fine">Varen bliver reserveret til dig, og du betaler under Mine køb.</p>
                  {d.auth === "approved" ? (
                    <p className="fine">Ægthed tjekket af Relived. Viser den sig at være falsk, får du alle pengene tilbage.</p>
                  ) : null}
                </>
              ) : state === "upcoming" && bid ? (
                <>
                  <p>
                    Den kommer på budsalg live{" "}
                    {show.starts_at ? `${dayLabel(show.starts_at).toLowerCase()} kl. ${clock(show.starts_at)}` : "snart"} i{" "}
                    <Link href={liveHref}>{show.title}</Link>. Buddene starter ved {kr(it.price)}, og det højeste bud vinder.
                  </p>
                  <RemindButton showId={show.id} itemId={it.id} next={href} className="btn btn-red btn-block" />
                  <p className="fine">Du får en mail, når showet starter.</p>
                </>
              ) : state === "upcoming" ? (
                <>
                  <p>
                    Den bliver vist live {show.starts_at ? `${dayLabel(show.starts_at).toLowerCase()} kl. ${clock(show.starts_at)}` : "snart"} i{" "}
                    <Link href={liveHref}>{show.title}</Link>. Du kan købe den, mens den bliver vist.
                  </p>
                  <RemindButton showId={show.id} itemId={it.id} next={href} className="btn btn-red btn-block" />
                  <p className="fine">Du får en mail, når showet starter.</p>
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
                        <b>Den bliver vist lige nu.</b> Gå ind i showet og køb den.
                      </>
                    ) : bid ? (
                      <>
                        <b>{seller.handle} er live nu.</b> Budsalget starter, når varen bliver vist.
                      </>
                    ) : (
                      <>
                        <b>{seller.handle} er live nu.</b> Varen er i køen. Gå ind i showet og køb den, når den bliver vist.
                      </>
                    )}
                  </p>
                  <Link className="btn btn-red btn-block" href={liveHref}>
                    <span className="live-dot white" aria-hidden="true" />
                    {bid ? "Se med og byd" : "Se med og køb"}
                  </Link>
                </>
              ) : state === "sold" ? (
                <>
                  <p>
                    <b>{isAuction(it) && it.high_bid ? `Den blev solgt på budsalg for ${kr(it.high_bid)}.` : "Den er solgt."}</b> Se om der er
                    noget lignende i kategorien, eller kig forbi, når {seller.handle} går live igen.
                  </p>
                  <Link className="btn btn-line btn-block" href={`/kategori/${cat.slug}`}>
                    Se {more}
                  </Link>
                </>
              ) : (
                <>
                  <p>Varen er ikke til salg lige nu. Sælgeren viser den måske i et kommende show.</p>
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
                  {[seller.area, d.video ? "Videoannonce" : show.status === "ended" ? `Fra showet ${show.title}` : show.title].filter(Boolean).join(" · ")}
                </span>
              </span>
            </Link>
            <FollowButton sellerId={it.seller_id} handle={seller.handle} next={href} />
            <SellerFacts seller={seller} />

            <ul className="item-trust">
              <li>Betalingen er beskyttet. Sælgeren får først pengene, når du har varen.</li>
              <li>Fragt {DELIVERY.ship.price} kr med DAO eller GLS, eller gratis afhentning.</li>
              <li>Køber du flere varer fra {seller.handle}, får du dem i én pakke.</li>
            </ul>
            <ReportButton type="item" id={it.id} className="item-report" />
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
              <h2 className="h3" id="h-lignende">{more.replace(/^./, (c) => c.toUpperCase())} til salg</h2>
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
