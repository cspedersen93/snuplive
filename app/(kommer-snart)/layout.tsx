import Link from "next/link";
import SupportLink from "@/components/SupportLink";
import { COMPANY, companyLine } from "@/lib/company";

/** Enkelt layout til "Kommer snart": kun logo øverst og de nødvendige links nederst. */
export default function SoonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="soon">
      <header className="soon-top">
        <div className="wrap">
          <Link className="logo" href="/" aria-label="Relived">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logo.svg" alt="Relived" width={129} height={38} />
          </Link>
        </div>
      </header>
      <main id="indhold">{children}</main>
      <footer className="soon-foot">
        <div className="wrap">
          <span>© {new Date().getFullYear()} {companyLine()} · {COMPANY.email}</span>
          <nav aria-label="Om Relived">
            <SupportLink>Skriv til os</SupportLink>
            <Link href="/privatliv">Privatlivspolitik</Link>
            <Link href="/om-relived">Om Relived og kontakt</Link>
            <Link href="/login">Tester? Log ind</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
