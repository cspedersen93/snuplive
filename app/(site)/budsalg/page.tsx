import type { Metadata } from "next";
import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import Pager from "@/components/Pager";
import { AUCTION_SECONDS, EXTEND_SECONDS } from "@/lib/auction";
import { vareOrd } from "@/lib/format";
import { feedTotal } from "@/lib/items";
import { fetchFeed } from "@/lib/queries";

const PER_PAGE = 30;

type Props = { searchParams: Promise<{ side?: string }> };

const pageOf = (sp: { side?: string }) => Math.max(1, Math.min(500, Number.parseInt(sp.side ?? "1", 10) || 1));
const href = (page: number) => (page > 1 ? `/budsalg?side=${page}` : "/budsalg");

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = pageOf(await searchParams);
  return {
    title: { absolute: "Budsalg live – byd på brugte varer | Relived" },
    description:
      "Byd på brugt tøj, design og samleobjekter live på video. Se varen tæt på, sæt et maks-bud før showet, og vind med det højeste bud.",
    alternates: { canonical: href(page) },
  };
}

/** Alle varer på budsalg i shows, der er live eller kommer snart (live først, så efter starttid). */
export default async function Budsalg({ searchParams }: Props) {
  const page = pageOf(await searchParams);
  const items = await fetchFeed("auctions", { limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const total = feedTotal(items);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <section className="phero" aria-labelledby="h-budsalg">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Budsalg</span>
          </nav>
          {total ? <span className="label red">{total} {vareOrd(total)} på budsalg</span> : null}
          <h1 className="h1" id="h-budsalg">Budsalg live – byd på brugte varer</h1>
          <p className="lede">
            Her er alle varer, der kommer på budsalg i de næste shows. Tryk på en vare for at se den, sætte et maks-bud eller
            trykke Husk mig, så du er klar, når budsalget starter.
          </p>
        </div>
      </section>

      <section className="sec tight" aria-label="Varer på budsalg">
        <div className="wrap">
          {items.length ? (
            <>
              <div className="icards">
                {items.map((it, i) => (
                  <ItemCard key={it.id} item={it} priority={i < 5} />
                ))}
              </div>
              <Pager page={page} pages={pages} href={href} />
            </>
          ) : (
            <div className="empty">
              <p style={{ marginBottom: 14 }}>
                {page > 1
                  ? "Der er ikke flere budsalg på den her side."
                  : "Der er ingen varer på budsalg lige nu. Når en sælger sætter varer på budsalg i et show, står de her."}
              </p>
              <div className="ctas" style={{ justifyContent: "center" }}>
                <Link className="btn btn-red" href="/live">Se programmet</Link>
                <Link className="btn btn-line" href="/saelg">Sæt dine varer på budsalg</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-budsalg-saadan">
        <div className="wrap">
          <h2 className="h2" id="h-budsalg-saadan" style={{ marginBottom: 24 }}>Sådan virker budsalg</h2>
          <ol className="steps">
            <li>
              <div>
                <h3>Find varen før showet</h3>
                <p>Se startprisen, og sæt et maks-bud, hvis du vil. Så byder vi for dig, op til dit maks.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Byd live</h3>
                <p>
                  Sælgeren viser varen frem, og budsalget kører i {AUCTION_SECONDS} sekunder. Kommer der et bud til sidst, står uret
                  på {EXTEND_SECONDS} sekunder igen.
                </p>
              </div>
            </li>
            <li>
              <div>
                <h3>Det højeste bud vinder</h3>
                <p>Vinder du, ligger varen i Mine køb til dit bud. Du betaler samlet bagefter, og alt fra samme sælger kommer i én pakke.</p>
              </div>
            </li>
          </ol>
          <p className="muted" style={{ marginTop: 22 }}>
            Får en vare ingen bud, kommer den til salg til startprisen bagefter. <Link href="/saadan-virker-det">Læs mere om, hvordan det virker</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
