"use client";

import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { IconCart, IconMenu, IconSearch, IconUser } from "@/components/Icons";
import { useShell } from "@/components/shell/ShellContext";

// Hele menuen til telefonen (under knappen øverst til højre). På computeren står den i venstre side.
const MNAV = [
  { href: "/live", label: "Live nu" },
  { href: "/#budsalg", label: "Budsalg" },
  { href: "/til-salg", label: "Til salg" },
  { href: "/klip", label: "Klip" },
  { href: "/kategori", label: "Kategorier" },
  { href: "/saadan-virker-det", label: "Sådan virker det" },
];

/**
 * Toppen. På computeren: søgefeltet, kurven og kontoen (logo og menu står i venstre side).
 * På telefonen: logoet, søg og en knap med hele menuen (kurv og konto står i bundmenuen).
 */
export default function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { signedIn, me, cartCount: count } = useShell();

  useEffect(() => setOpen(false), [path]);

  const current = (href: string) => (path === href || path.startsWith(href + "/") ? "page" : undefined);
  const sellHref = me?.is_seller ? "/studio" : "/saelg";

  return (
    <header className="head">
      <div className="head-in">
        <Link className="logo head-logo" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo.svg" alt="Relived – forside" width={142} height={48} />
        </Link>
        <Form action="/soeg" className="head-search" role="search">
          <IconSearch aria-hidden="true" />
          <label className="sr-only" htmlFor="head-q">
            Søg
          </label>
          <input id="head-q" name="q" type="search" placeholder="Søg i varer, shows og sælgere" autoComplete="off" />
        </Form>
        <div className="actions">
          <Link className="head-link" href="/saadan-virker-det" aria-current={current("/saadan-virker-det")}>
            Sådan virker det
          </Link>
          <Link className="icon-btn head-m" href="/soeg" aria-label="Søg" aria-current={current("/soeg")}>
            <IconSearch />
          </Link>
          <Link className="icon-btn head-d" href="/kurv" aria-label={count ? `Mine køb (${count})` : "Mine køb"}>
            <IconCart />
            <span className="badge" hidden={!count}>
              {count}
            </span>
          </Link>
          <Link
            className={`icon-btn head-d${me ? " has-ava" : ""}`}
            href={signedIn === false ? "/login" : "/konto"}
            aria-label={signedIn === false ? "Log ind" : "Min konto"}
          >
            {me ? <Avatar handle={me.handle} path={me.avatar_path} /> : <IconUser />}
          </Link>
          <button className="icon-btn menu-btn" type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <IconMenu />
          </button>
        </div>
      </div>
      <nav className="mnav" hidden={!open} aria-label="Menu">
        {MNAV.map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
        <Link href="/kurv">Mine køb</Link>
        <Link href={signedIn === false ? "/login" : "/konto"}>{signedIn === false ? "Log ind" : "Min konto"}</Link>
        <Link href={sellHref}>Sælg dine varer</Link>
      </nav>
    </header>
  );
}
