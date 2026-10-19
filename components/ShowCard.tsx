import Link from "next/link";
import Avatar from "@/components/Avatar";
import { category, clock, dayLabel } from "@/lib/format";
import { itemCount } from "@/lib/queries";
import type { ShowWithSeller } from "@/lib/types";

export default function ShowCard({ show, priority = false }: { show: ShowWithSeller; priority?: boolean }) {
  const handle = show.seller?.handle ?? "sælger";
  const cat = category(show.category);
  const n = itemCount(show);
  return (
    <Link className="scard" href={`/live/${handle}`} data-cat={show.category}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cat.cover} alt="" loading={priority ? "eager" : "lazy"} />
      <div className="v-badges">
        {show.status === "live" ? (
          <span className="b-live">
            <span className="live-dot white" />
            LIVE
          </span>
        ) : show.starts_at ? (
          <span className="b-view">
            {dayLabel(show.starts_at)} {clock(show.starts_at)}
          </span>
        ) : null}
      </div>
      <div className="scard-info">
        <h3>{show.title}</h3>
        <span className="handle">
          <Avatar handle={handle} />
          {handle}
          {n ? ` · ${n} ting` : ""}
        </span>
      </div>
    </Link>
  );
}
