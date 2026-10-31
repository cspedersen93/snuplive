import type { Metadata } from "next";
import Link from "next/link";
import { IconPlay } from "@/components/Icons";
import ItemCard from "@/components/ItemCard";
import Pager from "@/components/Pager";
import SortNote from "@/components/SortNote";
import { CATEGORIES, categoryBySlug, vareOrd } from "@/lib/format";
import { feedTotal } from "@/lib/items";
import { fetchFeed } from "@/lib/queries";

const PER_PAGE = 30;

type Props = { searchParams: Promise<{ kategori?: string; side?: string }> };

function parse(sp: { kategori?: string; side?: string }) {
  const cat = sp.kategori ? categoryBySlug(sp.kategori) : null;
  const page = Math.max(1, Math.min(500, Number.parseInt(sp.side ?? "1", 10) || 1));
  return { cat, page };
}

function href(cat: string | null, page: number) {
  const q = new URLSearchParams();
  if (cat) q.set("kategori", cat);
  if (page > 1) q.set("side", String(page));
  const s = q.toString();
  return s ? `/til-salg?${s}` : "/til-salg";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { cat, page } = parse(await searchParams);
  return {
    title: { absolute: cat ? `${cat.label} til salg brugt | Relived`.slice(0, 60) : "Brugt til salg – køb nu til fast pris | Relived" },
    description:
      "Køb brugt tøj, børnetøj, design og samleobjekter til fast pris. Alt er vist frem på video, så du ved, hvad du får. Fragt 49 kr til pakkeshop.",
    alternates: { canonical: href(cat?.slug ?? null, page) },
    // Filtrerede lister findes også som kategorisider, så kun den samlede liste skal i Google.
    robots: cat ? { index: false, follow: true } : undefined,
  };
}

export default async function TilSalg({ searchParams }: Props) {
  const { cat, page } = parse(await searchParams);
  const items = await fetchFeed("for_sale", { category: cat?.key ?? null, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const total = feedTotal(items);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <section className="phero" aria-labelledby="h-til-salg">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            {cat ? (
              <>
                <Link href="/til-salg">Til salg</Link>
                <span aria-hidden="true">/</span>
                <span>{cat.label}</span>
              </>
            ) : (
              <span>Til salg</span>
            )}
          </nav>
          {total ? <span className="label mint">{total} {vareOrd(total)} til salg</span> : null}
          <h1 className="h1" id="h-til-salg">{cat ? `${cat.label} til salg` : "Brugt til salg – køb nu til fast pris"}</h1>
          <p className="lede">Alt her er vist frem på video, i et live-show eller i en videoannonce. Køb det til fast pris lige nu.</p>
          {items.some((i) => i.clip_path) ? (
            <Link className="btn btn-red" href="/klip" style={{ marginTop: 18 }}>
              <IconPlay width={14} height={14} />
              Swipe gennem klip
            </Link>
          ) : null}
        </div>
      </section>

      <section className="sec tight" aria-label="Varer til salg">
        <div className="wrap">
          <nav className="filters" aria-label="Kategorier">
            <Link className="fchip" href="/til-salg" aria-current={cat ? undefined : "page"}>Alle</Link>
            {/* Kategorierne fører til kategorisiderne, så de får flere interne links. */}
            {CATEGORIES.map((c) => (
              <Link key={c.key} className="fchip" href={`/kategori/${c.slug}#til-salg`} aria-current={cat?.key === c.key ? "page" : undefined}>
                {c.short}
              </Link>
            ))}
          </nav>
          {items.length ? (
            <>
              <div className="icards">
                {items.map((it, i) => (
                  <ItemCard key={it.id} item={it} priority={i < 5} />
                ))}
              </div>
              <Pager page={page} pages={pages} href={(n) => href(cat?.slug ?? null, n)} />
              <SortNote />
            </>
          ) : (
            <div className="empty">
              <p style={{ marginBottom: 14 }}>
                {page > 1
                  ? "Der er ikke flere varer på den her side."
                  : cat
                    ? `Der er intet til salg i ${cat.label.toLowerCase()} lige nu. Kig forbi igen efter næste show.`
                    : "Der er ingen varer til salg lige nu. Varer fra live-shows og videoannoncer lander her."}
              </p>
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
            </div>
          )}
        </div>
      </section>

    </>
  );
}
