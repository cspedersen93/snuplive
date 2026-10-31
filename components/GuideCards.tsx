import Link from "next/link";
import { isValidElement, type ReactNode } from "react";
import { guideHref, type Guide } from "@/lib/guides";

export const AUDIENCE: Record<Guide["audience"], string> = { Sælger: "For sælgere", Køber: "For købere", Alle: "Køb og salg" };

/** Teksten i et stykke JSX (til læsetiden). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Ca. læsetid i minutter (200 ord i minuttet). */
export function readMinutes(g: Guide) {
  const text = [textOf(g.lede), ...g.sections.map((s) => `${s.h2} ${textOf(s.body)}`), ...g.faq.flat()].join(" ");
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
  return Math.max(3, Math.round(words / 200));
}

/** Kort til oversigten og "Læs også". */
export default function GuideCards({ guides, headingLevel = 3, four = false }: { guides: Guide[]; headingLevel?: 2 | 3; four?: boolean }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <ul className={four ? "guide-cards four" : "guide-cards"}>
      {guides.map((x) => (
        <li key={x.slug}>
          <Link href={guideHref(x)} className="guide-card">
            <img src={x.image.src} alt="" width={x.image.width} height={x.image.height} loading="lazy" style={{ objectPosition: x.image.position }} />
            <span className="label">{AUDIENCE[x.audience]} · {readMinutes(x)} min.</span>
            <H className="guide-card-title">{x.short}</H>
            <span className="muted">{x.teaser}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
