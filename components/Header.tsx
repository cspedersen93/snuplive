"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { IconCart, IconMenu, IconUser } from "@/components/Icons";
import { hasSupabase } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";

// Menuen er til køberne. Sælgerne har deres egen, stille knap ved siden af kurven.
const NAV = [
  { href: "/live", label: "Live nu" },
  { href: "/til-salg", label: "Til salg" },
  { href: "/klip", label: "Klip" },
  { href: "/kategori", label: "Kategorier" },
  { href: "/saadan-virker-det", label: "Sådan virker det" },
];

export default function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);
  const [me, setMe] = useState<{ handle: string; avatar_path: string | null; is_seller: boolean } | null>(null);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = getSupabase();
    let alive = true;
    const load = async (uid: string | null) => {
      if (!alive) return;
      setSignedIn(Boolean(uid));
      if (!uid) {
        setMe(null);
        return setCount(0);
      }
      const [sales, prof] = await Promise.all([
        sb.from("sales").select("id", { count: "exact", head: true }).eq("buyer_id", uid).eq("status", "reserved"),
        sb.from("profiles").select("handle,avatar_path,is_seller").eq("id", uid).maybeSingle(),
      ]);
      if (!alive) return;
      setCount(sales.count ?? 0);
      setMe(
        prof.data
          ? {
              handle: prof.data.handle as string,
              avatar_path: (prof.data.avatar_path as string | null) ?? null,
              is_seller: Boolean(prof.data.is_seller),
            }
          : null,
      );
    };
    sb.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => load(session?.user.id ?? null));
    const onSnup = () => sb.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null));
    window.addEventListener("snup:changed", onSnup);
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("snup:changed", onSnup);
    };
  }, []);

  const current = (href: string) => (path === href || path.startsWith(href + "/") ? "page" : undefined);
  // Sælgere går direkte til studiet. Alle andre ser først, hvordan man sælger.
  const sellHref = me?.is_seller ? "/studio" : "/saelg";

  return (
    <header className="head">
      <div className="wrap">
        <Link className="logo" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo.svg" alt="Relived – forside" width={129} height={38} />
        </Link>
        <nav className="nav" aria-label="Hovedmenu">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(n.href)}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="actions">
          <Link className="icon-btn" href="/kurv" aria-label={count ? `Mine køb (${count})` : "Mine køb"}>
            <IconCart />
            <span className="badge" hidden={!count}>
              {count}
            </span>
          </Link>
          <Link className={`icon-btn${me ? " has-ava" : ""}`} href={signedIn === false ? "/login" : "/konto"} aria-label={signedIn === false ? "Log ind" : "Min konto"}>
            {me ? <Avatar handle={me.handle} path={me.avatar_path} /> : <IconUser />}
          </Link>
          <Link className="btn btn-line btn-sm btn-sell" href={sellHref} aria-current={current(sellHref)}>
            Sælg
          </Link>
          <button
            className="icon-btn menu-btn"
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <IconMenu />
          </button>
        </div>
      </div>
      <div className="mnav" hidden={!open}>
        <div className="wrap">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>
              {n.label}
            </Link>
          ))}
          <Link href="/kurv">Mine køb</Link>
          <Link href={signedIn === false ? "/login" : "/konto"}>{signedIn === false ? "Log ind" : "Min konto"}</Link>
          <Link href={sellHref}>Sælg dine ting</Link>
        </div>
      </div>
    </header>
  );
}
