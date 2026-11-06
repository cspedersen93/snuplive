"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/components/Avatar";
import { IconCart, IconHome, IconLive, IconPlus, IconUser } from "@/components/Icons";
import { useShell } from "@/components/shell/ShellContext";

/** Sider, hvor bundmenuen ville stå i vejen: live-shows, studiet, klip i fuld skærm og gæstekameraet. */
export function hideTabBar(path: string) {
  return /^\/(live\/[^/]+|studio|klip|gaest)(\/|$)/.test(path);
}

/** Menulinjen i bunden på telefonen, som i en app. */
export default function TabBar({ launched = false }: { launched?: boolean }) {
  const path = usePathname();
  const { signedIn, me, cartCount, liveCount } = useShell();
  if (hideTabBar(path)) return null;
  const sellHref = me?.is_seller ? "/studio" : "/saelg";
  const meHref = signedIn === false ? "/login" : "/konto";
  const on = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/")) || undefined;

  return (
    <nav className="tabbar" aria-label="Genveje">
      <Link href="/" aria-current={on("/") && "page"}>
        <IconHome />
        <span>Forside</span>
      </Link>
      <Link href="/live" aria-current={on("/live") && "page"}>
        <span className="tab-ico">
          <IconLive />
          {liveCount ? <span className="tab-dot" aria-hidden="true" /> : null}
        </span>
        <span>Live{liveCount ? ` (${liveCount})` : ""}</span>
      </Link>
      <Link href={sellHref} className={`tab-sell${launched && !me?.is_seller ? " is-quiet" : ""}`} aria-current={on(sellHref) && "page"}>
        <span className="tab-plus">
          <IconPlus />
        </span>
        <span>Sælg</span>
      </Link>
      <Link href="/kurv" aria-current={on("/kurv") && "page"}>
        <span className="tab-ico">
          <IconCart />
          {cartCount ? <span className="tab-badge">{cartCount}</span> : null}
        </span>
        <span>Kurv</span>
      </Link>
      <Link href={meHref} aria-current={(on("/konto") || on("/login")) && "page"}>
        <span className="tab-ico">{me ? <Avatar handle={me.handle} path={me.avatar_path} /> : <IconUser />}</span>
        <span>{signedIn === false ? "Log ind" : "Mig"}</span>
      </Link>
    </nav>
  );
}
