import Link from "next/link";
import Avatar from "@/components/Avatar";
import { IconPlay } from "@/components/Icons";
import NoPhoto from "@/components/NoPhoto";
import RemindButton from "@/components/RemindButton";
import WelcomeVideo from "@/components/feed/WelcomeVideo";
import { itemMeta } from "@/components/Screen";
import { isAuction, soldPrice } from "@/lib/auction";
import { category, clock, dayLabel, kr, vareOrd } from "@/lib/format";
import { itemImage, showImage } from "@/lib/images";
import { itemHref, itemState } from "@/lib/items";
import { itemCount } from "@/lib/queries";
import type { FeedItem, ShowWithSeller } from "@/lib/types";

const when = (iso: string) => `${dayLabel(iso)} ${clock(iso)}`;

/** Det store kort øverst i feedet: showet, der er live (eller det næste, der starter). */
export function BigShowTile({ show }: { show: ShowWithSeller }) {
  const handle = show.seller?.handle ?? "sælger";
  const live = show.status === "live";
  const n = itemCount(show);
  const href = `/live/${handle}`;
  return (
    <div className="ftile ftile-big" data-cat={show.category}>
      <Link className="ftile-link" href={href}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ftile-img" src={showImage(show)} alt="" loading="eager" />
        <span className="ftile-shade" />
        <span className="ftile-badges">
          {live ? (
            <span className="fbadge live">
              <span className="live-dot white" />
              Live
            </span>
          ) : show.starts_at ? (
            <span className="fbadge later">Går live {when(show.starts_at).toLowerCase()}</span>
          ) : null}
          {show.language === "en" ? (
            <span className="fbadge b-lang" lang="en">
              English
            </span>
          ) : null}
        </span>
        <span className="ftile-info">
          <span className="ftile-handle">
            <Avatar handle={handle} path={show.seller?.avatar_path} />
            {handle} · {category(show.category).short}
          </span>
          <strong className="ftile-title">{show.title}</strong>
          {n ? (
            <span className="ftile-extra">
              {n} {vareOrd(n)} i showet
            </span>
          ) : null}
          {live ? <span className="btn btn-red ftile-btn">Se med nu</span> : null}
        </span>
      </Link>
      {!live ? (
        <div className="ftile-cta">
          <RemindButton showId={show.id} next="/" className="btn btn-red" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Det store kort, når ingen er live eller har planlagt et show. Er der varer til salg, peger det på dem. Er der intet
 * endnu, taler det til sælgerne indtil lanceringen og til køberne bagefter (tilmelding til nyhedsbrevet).
 */
export function WelcomeTile({ hasItems = true, launched = false }: { hasItems?: boolean; launched?: boolean }) {
  return (
    <div className="ftile ftile-big ftile-welcome">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <WelcomeVideo />
      <span className="ftile-shade" />
      <div className="ftile-info">
        <span className="fbadge">Ingen er live lige nu</span>
        {hasItems ? (
          <>
            <strong className="ftile-title">Se varer, der allerede er vist frem på video</strong>
            <span className="ftile-extra">Eller gå selv live og sælg en hel bunke på én aften.</span>
            <span className="ftile-btns">
              <Link className="btn btn-red" href="/til-salg">Se varer til salg</Link>
              <Link className="btn btn-line" href="/saelg">Sælg selv live</Link>
            </span>
          </>
        ) : launched ? (
          // Efter lanceringen taler kortet til køberne: få besked, når de første shows starter.
          <>
            <strong className="ftile-title">Vi går snart live</strong>
            <span className="ftile-extra">Få besked, når de næste shows starter, så er du med fra første budsalg.</span>
            <span className="ftile-btns">
              <Link className="btn btn-red" href="/nyhedsbrev">Få besked først</Link>
              <Link className="btn btn-line" href="/saelg">Sælg selv live</Link>
            </span>
          </>
        ) : (
          // Indtil lanceringen taler kortet til sælgerne, så der kommer varer på siden.
          <>
            <strong className="ftile-title">Vær med fra starten</strong>
            <span className="ftile-extra">
              Gå live fra stuen, og sælg en hel bunke på én aften. Det er gratis at sælge, mens vi er i beta.
            </span>
            <span className="ftile-btns">
              <Link className="btn btn-red" href="/saelg">Sælg selv live</Link>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** Et lille kort med et show (live eller senere). */
export function ShowTile({ show }: { show: ShowWithSeller }) {
  const handle = show.seller?.handle ?? "sælger";
  const live = show.status === "live";
  const n = itemCount(show);
  return (
    <Link className="ftile" href={`/live/${handle}`} data-cat={show.category}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ftile-img" src={showImage(show)} alt="" loading="lazy" />
      <span className="ftile-shade" />
      <span className="ftile-badges">
        {live ? (
          <span className="fbadge live">
            <span className="live-dot white" />
            Live
          </span>
        ) : show.starts_at ? (
          <span className="fbadge later">{when(show.starts_at)}</span>
        ) : null}
        {show.language === "en" ? (
          <span className="fbadge b-lang" lang="en">
            English
          </span>
        ) : null}
      </span>
      <span className="ftile-info">
        <span className="ftile-handle">{handle}</span>
        <strong className="ftile-name">{show.title}</strong>
        <span className="ftile-row">
          <span className="ftile-extra">{category(show.category).short}</span>
          {n ? (
            <span className="ftile-extra">
              {n} {vareOrd(n)}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

/** Et lille kort med en vare: til salg, på budsalg eller i et show, der kommer. */
export function ItemTile({ item }: { item: FeedItem }) {
  const img = itemImage(item);
  const state = itemState(item);
  const shown = state === "upcoming" || state === "live" || state === "showing";
  const bid = isAuction(item) && shown;
  const price =
    state === "sold" ? kr(soldPrice(item)) : bid ? (item.high_bid ? `Bud ${kr(item.high_bid)}` : `Fra ${kr(item.price)}`) : kr(item.price);
  const meta = itemMeta(item);
  return (
    <Link className="ftile" href={itemHref(item)} data-cat={item.category}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ftile-img" src={img} alt="" loading="lazy" />
      ) : (
        <NoPhoto cat={item.category} text={shown ? "Vises live" : "Intet billede"} />
      )}
      <span className="ftile-shade" />
      <span className="ftile-badges">
        {state === "live" || state === "showing" ? (
          <span className="fbadge live">
            <span className="live-dot white" />
            Live
          </span>
        ) : bid && item.starts_at ? (
          <span className="fbadge bid">Budsalg {when(item.starts_at).toLowerCase()}</span>
        ) : state === "upcoming" && item.starts_at ? (
          <span className="fbadge later">Vises {when(item.starts_at).toLowerCase()}</span>
        ) : state === "for_sale" && item.clip_path ? (
          <span className="fbadge">
            <IconPlay />
            Video
          </span>
        ) : state === "for_sale" ? (
          <span className="fbadge">Køb nu</span>
        ) : state === "sold" ? (
          <span className="fbadge">Solgt</span>
        ) : null}
      </span>
      <span className="ftile-info">
        <span className="ftile-handle">{item.handle}</span>
        <strong className="ftile-name">{item.name}</strong>
        <span className="ftile-row">
          <strong className="ftile-price num">{price}</strong>
          {meta ? <span className="ftile-extra">{meta}</span> : null}
        </span>
      </span>
    </Link>
  );
}
