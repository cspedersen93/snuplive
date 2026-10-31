import Link from "next/link";
import { COMPANY, companyLine } from "@/lib/company";
import { MAIN_CATEGORIES } from "@/lib/format";
import SupportLink from "./SupportLink";

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Link className="logo" href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/logo.svg" alt="Relived" width={129} height={38} loading="lazy" />
            </Link>
            <p>Second hand, du kan se live, før du køber. Spørg sælgeren i chatten, og køb med ét tryk.</p>
          </div>
          <div>
            <h2>Køb</h2>
            <ul>
              <li><Link href="/live">Live nu</Link></li>
              <li><Link href="/til-salg">Til salg</Link></li>
              <li><Link href="/kategori">Kategorier</Link></li>
              <li><Link href="/saadan-virker-det">Sådan virker det</Link></li>
              <li><Link href="/kurv">Mine køb</Link></li>
            </ul>
          </div>
          <div>
            <h2>Sælg</h2>
            <ul>
              <li><Link href="/saelg">Bliv sælger</Link></li>
              <li><Link href="/opret">Opret konto</Link></li>
              <li><Link href="/studio">Mine shows</Link></li>
            </ul>
          </div>
          <div>
            <h2>Kategorier</h2>
            <ul>
              {MAIN_CATEGORIES.map((c) => (
                <li key={c.key}><Link href={`/kategori/${c.slug}`}>{c.short === "Børn" ? "Børnetøj" : c.short}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Hjælp</h2>
            <ul>
              <li><SupportLink>Skriv til os</SupportLink></li>
              <li><Link href="/faq">Spørgsmål og svar</Link></li>
              <li><Link href="/guides">Guides</Link></li>
              <li><Link href="/saadan-virker-det#tryg-handel">Tryg handel</Link></li>
              <li><Link href="/handelsbetingelser">Handelsbetingelser</Link></li>
              <li><Link href="/vilkaar">Vilkår</Link></li>
              <li><Link href="/privatliv">Privatlivspolitik</Link></li>
              <li><Link href="/cookies">Cookies</Link></li>
              <li><Link href="/om-relived">Om Relived og kontakt</Link></li>
              <li><Link href="/en" lang="en" hrefLang="en">Relived in English</Link></li>
              <li><Link href="/saadan-virker-det#sortering">Sådan sorterer vi</Link></li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} {companyLine()} · {COMPANY.email}</span>
          <span>Fotos: Pexels</span>
        </div>
      </div>
    </footer>
  );
}
