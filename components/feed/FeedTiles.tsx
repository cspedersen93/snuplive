import Link from "next/link";
import Avatar from "@/components/Avatar";
import { IconPlay } from "@/components/Icons";
import NoPhoto from "@/components/NoPhoto";
import RemindButton from "@/components/RemindButton";
import Countdown from "@/components/feed/Countdown";
import WelcomeVideo from "@/components/feed/WelcomeVideo";
import { itemMeta } from "@/components/Screen";
import { isAuction, soldPrice } from "@/lib/auction";
import { category, clock, dayLabel, kr, vareOrd } from "@/lib/format";
import { clipUrl, itemImage, showImage } from "@/lib/images";
import { itemHref, itemState } from "@/lib/items";
import { itemCount } from "@/lib/queries";
import type { FeedItem, ShowWithSeller } from "@/lib/types";

const when = (iso: string) => `${dayLabel(iso)} ${clock(iso)}`;

/** Et stort kort med et show (live eller det næste). Bruges ikke på forsiden længere: der står velkomstvideoen altid. */
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
          {live ? <span className="btn btn-ivory ftile-btn">Se med nu</span> : null}
        </span>
      </Link>
      {!live ? (
        <div className="ftile-cta">
          <RemindButton showId={show.id} next="/" className="btn btn-ivory" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Det store kort øverst på forsiden. Det fortæller altid, hvad der er at se:
 * 1. nogen er live → se med, 2. et show er planlagt → nedtælling og Husk mig, 3. der er et klip fra et show →
 * klippet spiller, 4. der er varer til salg → se dem, 5. ellers: sælgerne indtil lanceringen, køberne bagefter.
 */
export function WelcomeTile({
  hasItems = true,
  launched = false,
  liveCount = 0,
  next = null,
  clip = null,
}: {
  hasItems?: boolean;
  launched?: boolean;
  liveCount?: number;
  next?: ShowWithSeller | null;
  clip?: FeedItem | null;
}) {
  const clipSrc = !liveCount && !next && clip ? clipUrl(clip) : null;
  const clipPoster = clip ? itemImage(clip) : null;
  const nextHandle = next?.seller?.handle ?? "sælger";
  const nextCount = next ? itemCount(next) : 0;
  return (
    <div className={`ftile ftile-big ftile-welcome${clipSrc ? " has-clip" : ""}`}>
      {clipSrc ? (
        <>
          {/* Klippet er filmet på højkant: det står i sin egen ramme, med varens billede sløret bagved. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {clipPoster ? <img className="ftile-img ftile-blur" src={clipPoster} alt="" /> : null}
          <span className="ftile-clip">
            <WelcomeVideo clip={clipSrc} poster={clipPoster ?? undefined} className="ftile-clipvid" />
          </span>
        </>
      ) : (
        <WelcomeVideo />
      )}
      <span className="ftile-shade" />
      <div className="ftile-info">
        {liveCount ? (
          // Nogen er live: kortet viser stadig videoen, men fortæller det og sender videre til Live nu.
          <>
            <span className="fbadge live">
              <span className="live-dot white" />
              {liveCount === 1 ? "1 sælger er live nu" : `${liveCount} sælgere er live nu`}
            </span>
            <strong className="ftile-title">Se med, mens varerne bliver vist frem</strong>
            <span className="ftile-extra">Spørg sælgeren i chatten, og køb med ét tryk, eller byd med på budsalg.</span>
            <span className="ftile-btns">
              <Link className="btn btn-ivory" href="/live">Se hvem der er live</Link>
              <Link className="btn btn-line" href="/til-salg">Se varer til salg</Link>
            </span>
          </>
        ) : next?.starts_at ? (
          // Et show er på vej: hvornår, hvem og hvad, med nedtælling og Husk mig.
          <>
            <span className="fbadge later">Næste show · {when(next.starts_at).toLowerCase()}</span>
            <strong className="ftile-title">{next.title}</strong>
            <span className="ftile-extra">
              Hos {nextHandle}
              {nextCount ? ` · ${nextCount} ${vareOrd(nextCount)} i showet` : ""}
              <Countdown to={next.starts_at} className="ftile-count" />
            </span>
            <span className="ftile-btns">
              <RemindButton showId={next.id} next="/" className="btn btn-ivory" />
              <Link className="btn btn-line" href={`/live/${nextHandle}`}>Se showet</Link>
            </span>
          </>
        ) : clipSrc && clip ? (
          // Ingen shows i kalenderen, men der er noget at se: et klip af en vare, der stadig er til salg.
          <>
            <span className="fbadge">
              <IconPlay />
              Klip fra et show
            </span>
            <strong className="ftile-title">{clip.name}</strong>
            <span className="ftile-extra">
              {kr(clip.price)} hos {clip.handle}. Vist frem på video, og stadig til salg.
            </span>
            <span className="ftile-btns">
              <Link className="btn btn-ivory" href={itemHref(clip)}>Se varen</Link>
              <Link className="btn btn-line" href="/klip">Flere klip</Link>
            </span>
          </>
        ) : hasItems ? (
          <>
            <span className="fbadge">Til salg nu</span>
            <strong className="ftile-title">Se varer, der allerede er vist frem på video</strong>
            <span className="ftile-extra">Eller gå selv live og sælg en hel bunke på én aften.</span>
            <span className="ftile-btns">
              <Link className="btn btn-ivory" href="/til-salg">Se varer til salg</Link>
              <Link className="btn btn-line" href="/saelg">Sælg dine varer</Link>
            </span>
          </>
        ) : launched ? (
          // Efter lanceringen taler kortet til køberne: få besked, når de første shows starter.
          <>
            <strong className="ftile-title">Vi går snart live</strong>
            <span className="ftile-extra">Få besked, når de næste shows starter, så er du med fra første budsalg.</span>
            <span className="ftile-btns">
              <Link className="btn btn-ivory" href="/nyhedsbrev">Få besked først</Link>
              <Link className="btn btn-line" href="/saelg">Sælg dine varer</Link>
            </span>
          </>
        ) : (
          // Indtil lanceringen taler kortet til sælgerne, så der kommer varer på siden.
          <>
            <span className="fbadge">Åbner snart</span>
            <strong className="ftile-title">Vær med fra starten</strong>
            <span className="ftile-extra">
              Gå live fra stuen, og sælg en hel bunke på én aften. Det er gratis at sælge, mens vi er i beta.
            </span>
            <span className="ftile-btns">
              <Link className="btn btn-ivory" href="/saelg">Sælg dine varer</Link>
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
          // To små mærker i stedet for ét langt, så de kan være der på telefonen.
          <>
            <span className="fbadge bid">Budsalg</span>
            <span className="fbadge later">{when(item.starts_at)}</span>
          </>
        ) : state === "upcoming" && item.starts_at ? (
          <span className="fbadge later">{when(item.starts_at)}</span>
        ) : state === "for_sale" && item.clip_path ? (
          <span className="fbadge">
            <IconPlay />
            Video
          </span>
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
