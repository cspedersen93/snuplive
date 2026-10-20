"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overblik" },
  { href: "/admin/sager", label: "Sager" },
  { href: "/admin/ordrer", label: "Ordrer" },
  { href: "/admin/medlemmer", label: "Medlemmer" },
  { href: "/admin/shows", label: "Shows" },
];

export default function AdminNav({ openIssues }: { openIssues: number }) {
  const path = usePathname();
  return (
    <nav className="adm-nav" aria-label="Backoffice">
      <span className="label">Backoffice</span>
      <div className="adm-tabs">
        {TABS.map((t) => {
          const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className="adm-tab" aria-current={active ? "page" : undefined}>
              {t.label}
              {t.href === "/admin/sager" && openIssues ? <span className="count">{openIssues}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
