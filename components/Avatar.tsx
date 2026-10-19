import { gradFor, initial } from "@/lib/format";
import { avatarUrl } from "@/lib/images";

interface Props {
  handle: string;
  path?: string | null;
  size?: number;
  className?: string;
}

/** Profilbillede, eller sælgerens forbogstav på en farvet baggrund, hvis der ikke er et billede. */
export default function Avatar({ handle, path, size, className = "" }: Props) {
  const style: React.CSSProperties = { background: gradFor(handle) };
  if (size) Object.assign(style, { width: size, height: size, fontSize: size * 0.42 });
  const url = avatarUrl(path);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={`ava ava-img ${className}`} style={style} src={url} alt="" aria-hidden="true" loading="lazy" />
    );
  }
  return (
    <span className={`ava ${className}`} style={style} aria-hidden="true">
      {initial(handle)}
    </span>
  );
}
