import type { Metadata } from "next";
import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import Pager from "@/components/Pager";
import SaveSearchButton from "@/components/SaveSearchButton";
import SearchForm from "@/components/SearchForm";
import { vareOrd } from "@/lib/format";
import { feedTotal } from "@/lib/items";
import { parseSearch, searchable, searchHref, searchLabel } from "@/lib/search";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { FeedItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 30;
const POPULAR = ["Uldfrakke", "Kjole", "Jeans", "Sneakers", "Designertaske", "Flyverdragt", "Barnevogn", "Cykel", "Lampe", "LEGO", "Vinyl"];

type Props = { searchParams: Promise<{ q?: string; kategori?: string; maks?: string; str?: string; side?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const s = parseSearch(await searchParams);
  return {
    title: searchable(s) ? `Søg: ${searchLabel(s)}`.slice(0, 50) : "Søg i varer, shows og sælgere",
    description: "Søg i varer, shows og sælgere: second hand til salg nu, live nu eller snart på Relived.",
    // Søgeresultater skal ikke i Google (de skifter hele tiden). Linkene på siden må gerne følges.
    robots: { index: false, follow: true },
    alternates: { canonical: "/soeg" },
  };
}

export default async function Soeg({ searchParams }: Props) {
  const s = parseSearch(await searchParams);
  const can = searchable(s);
  let items: FeedItem[] = [];
  let ready = true;
  const sb = createPublicClient();
  if (can && sb) {
    const { data, error } = await sb.rpc("search_items", {
      p_q: s.q || null,
      p_category: s.category,
      p_max_price: s.maxPrice,
      p_size: s.size,
      p_limit: PER_PAGE,
      p_offset: (s.page - 1) * PER_PAGE,
    });
    if (error) ready = false; // 0024_soegning.sql er ikke kørt endnu
    else items = (data ?? []) as FeedItem[];
  }
  const total = feedTotal(items);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const uid = await getUserId(await createClient()).catch(() => null);

  return (
    <>
      <section className="phero" aria-labelledby="h-soeg">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Søg</span>
          </nav>
          <h1 className="h2" id="h-soeg">Søg i varer, shows og sælgere</h1>
          <p className="lede">Find det, der er til salg nu, live nu og bliver vist snart. Gem søgningen, så får du besked, når der kommer nyt.</p>
          <SearchForm s={s} autoFocus={!can} />
        </div>
      </section>

      <section className="sec tight" aria-labelledby="h-soeg-res">
        <div className="wrap">
          {!can ? (
            <>
              <h2 className="h3" id="h-soeg-res" style={{ marginBottom: 14 }}>Populære søgninger</h2>
              <nav className="filters" aria-label="Populære søgninger">
                {POPULAR.map((p) => (
                  <Link key={p} className="fchip" href={searchHref({ q: p, category: null, maxPrice: null, size: null })}>{p}</Link>
                ))}
              </nav>
            </>
          ) : !ready ? (
            <div className="notice" role="status" id="h-soeg-res">
              <span>Søgningen er ved at blive sat op. Prøv igen om lidt, eller se alt <Link href="/til-salg">til salg</Link>.</span>
            </div>
          ) : (
            <>
              <div className="row-head search-head">
                <h2 className="h3" id="h-soeg-res">
                  {total ? `${total} ${vareOrd(total)}` : "Ingen varer lige nu"}
                  <span className="muted search-for"> til {searchLabel(s)}</span>
                </h2>
                <SaveSearchButton s={s} signedIn={Boolean(uid)} />
              </div>
              {items.length ? (
                <>
                  <div className="icards">
                    {items.map((it, i) => (
                      <ItemCard key={it.id} item={it} priority={i < 5} />
                    ))}
                  </div>
                  <Pager page={s.page} pages={pages} href={(n) => searchHref(s, n)} />
                </>
              ) : (
                <div className="empty">
                  <p style={{ marginBottom: 6 }}>Der er ingen varer, der passer, lige nu.</p>
                  <p>Tryk <b>Giv mig besked om nye</b>, så får du besked, når en sælger lægger noget op, der passer.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
