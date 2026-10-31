import Link from "next/link";
import Avatar from "@/components/Avatar";
import { IconPlay } from "@/components/Icons";
import NoPhoto from "@/components/NoPhoto";
import { itemMeta } from "@/components/Screen";
import { clock, dayLabel, kr } from "@/lib/format";
import { isAuction, soldPrice } from "@/lib/auction";
import { itemImage } from "@/lib/images";
import { itemHref, itemState } from "@/lib/items";
import type { FeedItem } from "@/lib/types";

/** Et kort med en ting: billede, pris og hvor tingen er (kommende show, live eller til salg). */
export default function ItemCard({ item, priority = false }: { item: FeedItem; priority?: boolean }) {
  const img = itemImage(item);
  const state = itemState(item);
  const meta = itemMeta(item);
  const bid = isAuction(item) && (state === "upcoming" || state === "live" || state === "showing");
  const price =
    state === "sold"
      ? kr(soldPrice(item))
      : bid
        ? item.high_bid
          ? `Bud ${kr(item.high_bid)}`
          : `Fra ${kr(item.price)}`
        : kr(item.price);
  return (
    <Link className="icard" href={itemHref(item)}>
      <div className="icard-img">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading={priority ? "eager" : "lazy"} />
        ) : (
          <NoPhoto cat={item.category} text={state === "upcoming" || state === "live" || state === "showing" ? "Vises live" : "Intet billede"} />
        )}
        <span className="icard-badge">
          {bid ? <span className="b-bid">Budsalg</span> : null}
          {state === "live" || state === "showing" ? (
            <span className="b-live">
              <span className="live-dot white" />
              LIVE
            </span>
          ) : state === "upcoming" && item.starts_at ? (
            <span className="b-view">
              {dayLabel(item.starts_at)} {clock(item.starts_at)}
            </span>
          ) : state === "for_sale" ? (
            <span className="b-buy">Køb nu</span>
          ) : state === "sold" ? (
            <span className="b-view">Solgt</span>
          ) : null}
          {state === "for_sale" && item.clip_path ? (
            <span className="b-view" title="Se varen på video">
              <IconPlay />
              Video
            </span>
          ) : null}
        </span>
      </div>
      <div className="icard-info">
        <strong className="num">{price}</strong>
        <span className="icard-title">{item.name}</span>
        {meta ? <span className="icard-meta">{meta}</span> : null}
        <span className="handle">
          <Avatar handle={item.handle} path={item.avatar_path} />
          {item.handle}
        </span>
      </div>
    </Link>
  );
}
