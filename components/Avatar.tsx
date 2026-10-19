import { gradFor, initial } from "@/lib/format";

export default function Avatar({ handle, size, className = "" }: { handle: string; size?: number; className?: string }) {
  const style: React.CSSProperties = { background: gradFor(handle) };
  if (size) Object.assign(style, { width: size, height: size, fontSize: size * 0.42 });
  return (
    <span className={`ava ${className}`} style={style} aria-hidden="true">
      {initial(handle)}
    </span>
  );
}
