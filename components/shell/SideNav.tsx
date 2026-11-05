"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/components/Avatar";
import CategoryIcon from "@/components/CategoryIcon";
import { IconBag, IconGavel, IconGrid, IconHome, IconLive, IconPlus, IconVideo } from "@/components/Icons";
import { useShell } from "@/components/shell/ShellContext";
import { MAIN_CATEGORIES } from "@/lib/format";

const MAIN = [
  { href: "/", label: "For dig", Icon: IconHome },
  { href: "/live", label: "Live nu", Icon: IconLive },
  { href: "/budsalg", label: "Budsalg", Icon: IconGavel },
  { href: "/til-salg", label: "Til salg", Icon: IconBag },
  { href: "/klip", label: "Klip", Icon: IconVideo },
  { href: "/kategori", label: "Kategorier", Icon: IconGrid },
];

/**
 * Menuen i venstre side på computeren. Bred med tekst, kategorier og dem, man følger, når der er plads.
 * Smal med kun ikoner på mindre skærme og i live-shows, så videoen får pladsen.
 */
export default function SideNav() {
  const path = usePathname();
  const { me, liveCount, liveSellers, follows } = useShell();
  const sellHref = me?.is_seller ? "/studio" : "/saelg";
  const current = (href: string) => {
    if (href.includes("#")) return undefined;
    if (href === "/") return path === "/" ? "page" : undefined;
    return path === href || path.startsWith(href + "/") ? "page" : undefined;
  };
  const live = new Set(liveSellers);
  const followed = [...follows].sort((a, b) => Number(live.has(b.id)) - Number(live.has(a.id))).slice(0, 6);

  return (
    <aside className="side" aria-label="Menu">
      <Link className="side-logo" href="/" aria-label="Relived – forside">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="side-logo-full" src="/img/logo.svg" alt="" width={142} height={48} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="side-logo-mark" src="/img/logo-mark.svg" alt="" width={40} height={40} />
      </Link>

      <nav className="side-nav" aria-label="Hovedmenu">
        {MAIN.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={current(href)} title={label}>
            <Icon />
            <span className="side-label">{label}</span>
            {href === "/live" && liveCount ? (
              <span className="side-count" aria-label={`${liveCount} live`}>
                {liveCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="side-group side-wide">
        <span className="side-head">Kategorier</span>
        {MAIN_CATEGORIES.map((c) => (
          <Link key={c.key} href={`/kategori/${c.slug}`} aria-current={current(`/kategori/${c.slug}`)}>
            <CategoryIcon k={c.key} size={18} />
            <span>{c.key === "boernetoej" ? "Børnetøj" : c.key === "cykler" ? "Cykler og barnevogne" : c.short}</span>
          </Link>
        ))}
      </div>

      {followed.length ? (
        <div className="side-group side-wide">
          <span className="side-head">Du følger</span>
          {followed.map((f) => (
            <Link key={f.id} href={`/live/${f.handle}`} aria-current={current(`/live/${f.handle}`)}>
              <Avatar handle={f.handle} path={f.avatar_path} className={live.has(f.id) ? "is-live" : ""} />
              <span className="side-handle">{f.handle}</span>
              {live.has(f.id) ? <span className="side-live">Live</span> : null}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="side-foot">
        <Link className="btn btn-red side-sell" href={sellHref} title="Sælg en vare" aria-current={current(sellHref)}>
          <IconPlus />
          <span className="side-label">Sælg en vare</span>
        </Link>
      </div>
    </aside>
  );
}
