import Link from "next/link";
import Avatar from "@/components/Avatar";
import { itemMeta } from "@/components/Screen";
import { clock, dayLabel, gradFor, kr } from "@/lib/format";
import { itemImage } from "@/lib/images";
import { itemHref, itemState } from "@/lib/items";
import type { FeedItem } from "@/lib/types";

/** Et kort med en ting: billede, pris og hvor tingen er (kommende show, live eller til salg). */
export default function ItemCard({ item, priority = false }: { item: FeedItem; priority?: boolean }) {
  const img = itemImage(item);
  const state = itemState(item);
  const meta = itemMeta(item);
  return (
    <Link className="icard" href={itemHref(item)}>
      <div className="icard-img" style={img ? undefined : { background: gradFor(item.id) }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading={priority ? "eager" : "lazy"} />
        ) : (
          <span className="icard-name" aria-hidden="true">{item.name}</span>
        )}
        <span className="icard-badge">
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
        </span>
      </div>
      <div className="icard-info">
        <strong className="num">{kr(item.price)}</strong>
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
