import type { Metadata } from "next";
import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import Pager from "@/components/Pager";
import { CATEGORIES, categoryBySlug } from "@/lib/format";
import { feedTotal } from "@/lib/items";
import { DELIVERY, RESERVATION_DAYS } from "@/lib/pricing";
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
    title: { absolute: cat ? `${cat.label} til salg brugt | SnupLive`.slice(0, 60) : "Brugt til salg – køb nu til fast pris | SnupLive" },
    description:
      "Køb brugt tøj, børnetøj, design og samlerting til fast pris. Tingene er vist frem live, så du ved, hvad du får. Fragt 49 kr til pakkeshop.",
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
          <span className="label mint">{total ? `${total} ${total === 1 ? "ting" : "ting"} til salg` : "Køb nu"}</span>
          <h1 className="h1" id="h-til-salg">{cat ? `${cat.label} til salg` : "Brugt til salg – køb nu til fast pris"}</h1>
          <p className="lede">
            Ting fra tidligere live-shows, som ikke blev snuppet. Sælgeren har vist dem frem på video, og du kan købe dem til
            fast pris lige nu.
          </p>
        </div>
      </section>

      <section className="sec tight" aria-label="Ting til salg">
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
            </>
          ) : (
            <div className="empty">
              <p style={{ marginBottom: 14 }}>
                {page > 1
                  ? "Der er ikke flere ting på den her side."
                  : cat
                    ? `Der er intet til salg i ${cat.label.toLowerCase()} lige nu. Kig forbi igen efter næste show.`
                    : "Der er ingen ting til salg lige nu. Usolgte ting fra live-shows lander her, når showet er slut."}
              </p>
              <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
            </div>
          )}
        </div>
      </section>

      <section className="sec band" aria-label="Sådan køber du med Køb nu">
        <div className="wrap salg-faq">
          <div>
            <h2 className="h3">Hvorfor er tingene til salg her?</h2>
            <p className="muted">
              Alt på siden har været vist frem i et live-show, men blev ikke snuppet. Når showet slutter, kommer tingene automatisk
              til salg. Prisen står på, og sælgeren kan stadig svare på spørgsmål i sit næste show.
            </p>
          </div>
          <div>
            <h2 className="h3">Hvordan køber du med Køb nu?</h2>
            <ol className="plain-steps">
              <li>Tryk Køb nu på tingen. Så er den reserveret til dig, og ingen andre kan købe den.</li>
              <li>Betal under Mine snup inden for {RESERVATION_DAYS} dage med MobilePay eller kort.</li>
              <li>Vælg en pakkeshop, eller hent tingen hos sælgeren.</li>
            </ol>
          </div>
          <div>
            <h2 className="h3">Hvad koster fragten?</h2>
            <p className="muted">
              Fragt til en DAO- eller GLS-pakkeshop koster {DELIVERY.ship.price} kr pr. sælger, op til 5 kg. Køber du flere ting hos
              samme sælger, kommer de i én pakke. Afhentning er gratis. Oven i kommer en køberbeskyttelse på 5 % + 5 kr pr. pakke.
            </p>
          </div>
          <div className="ctas">
            <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
            <Link className="btn btn-line" href="/faq">Spørgsmål og svar</Link>
          </div>
        </div>
      </section>
    </>
  );
}
