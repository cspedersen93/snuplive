import Avatar from "@/components/Avatar";
import { IconEye } from "@/components/Icons";

export function ScreenTop({
  handle,
  avatarPath,
  area,
  live,
  viewers,
  guests,
}: {
  handle: string;
  avatarPath?: string | null;
  area?: string | null;
  live: boolean;
  viewers: number;
  /** Gæster i showet (vises som "+ @lise"). */
  guests?: { handle: string; avatar_path: string | null }[];
}) {
  return (
    <div className="v-top">
      <div className="v-seller">
        <Avatar handle={handle} path={avatarPath} />
        {guests?.length ? (
          <span className="v-guests" aria-hidden="true">
            {guests.map((g) => (
              <Avatar key={g.handle} handle={g.handle} path={g.avatar_path} />
            ))}
          </span>
        ) : null}
        <span className="v-who">
          {guests?.length ? `${handle} + ${guests.map((g) => g.handle).join(" + ")}` : handle}
          {guests?.length ? <small>Sælger sammen</small> : area ? <small>{area}</small> : null}
        </span>
      </div>
      {live ? (
        <div className="v-badges">
          <span className="b-live">
            <span className="live-dot white" />
            LIVE
          </span>
          <span className="b-view" aria-label={`${viewers} ser med`}>
            <IconEye />
            {viewers}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function itemMeta(i: { size: string | null; condition: string | null }) {
  return [i.size ? `Str. ${i.size}` : null, i.condition].filter(Boolean).join(" · ");
}
