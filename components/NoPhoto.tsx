import CategoryIcon from "@/components/CategoryIcon";
import { category } from "@/lib/format";

/** Når en ting ikke har billeder endnu: en rolig flade med kategoriens ikon i stedet for et farvet felt. */
export default function NoPhoto({ cat, text, size = "card" }: { cat?: string | null; text?: string; size?: "card" | "large" }) {
  const c = category(cat);
  return (
    <span className={`nophoto${size === "large" ? " lg" : ""}`} aria-hidden="true">
      <i>
        <CategoryIcon k={c.key} size={size === "large" ? 34 : 24} />
      </i>
      {text ? <span>{text}</span> : null}
    </span>
  );
}
