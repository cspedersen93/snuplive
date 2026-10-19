import Avatar from "@/components/Avatar";
import { IconEye } from "@/components/Icons";

export function ScreenTop({ handle, avatarPath, area, live, viewers }: { handle: string; avatarPath?: string | null; area?: string | null; live: boolean; viewers: number }) {
  return (
    <div className="v-top">
      <div className="v-seller">
        <Avatar handle={handle} path={avatarPath} />
        <span className="v-who">
          {handle}
          {area ? <small>{area}</small> : null}
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
