import Link from "next/link";
import CategoryIcon from "@/components/CategoryIcon";
import { CATEGORIES } from "@/lib/format";

/** Alle kategorierne som kort med billede, ikon og en kort tekst (4 pr. række på computeren, den sidste i fuld bredde, hvis den står alene). */
export default function CategoryCards({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <ul className="catcards">
      {CATEGORIES.map((c) => (
        <li key={c.key}>
          <Link className="catcard" href={`/kategori/${c.slug}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.card} alt="" loading="lazy" />
            <span className="catcard-body">
              <span className="catcard-ico" aria-hidden="true">
                <CategoryIcon k={c.key} />
              </span>
              <H className="catcard-title">{c.label}</H>
              <span className="catcard-blurb">{c.blurb}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
