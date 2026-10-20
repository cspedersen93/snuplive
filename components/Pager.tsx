import Link from "next/link";

/** Forrige/næste side under en liste. href(n) giver adressen til side n. */
export default function Pager({ page, pages, href }: { page: number; pages: number; href: (n: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Sider">
      {page > 1 ? (
        <Link className="btn btn-line btn-sm" href={href(page - 1)} rel="prev">← Forrige</Link>
      ) : (
        <span />
      )}
      <span className="muted num">Side {page} af {pages}</span>
      {page < pages ? (
        <Link className="btn btn-line btn-sm" href={href(page + 1)} rel="next">Næste →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
