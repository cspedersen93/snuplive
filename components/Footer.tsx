import Link from "next/link";
import { MAIN_CATEGORIES } from "@/lib/format";

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Link className="logo" href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/logo.png" alt="SnupLive" width={169} height={50} loading="lazy" />
            </Link>
            <p>Køb brugt tøj og ting live. Se tingen på video, spørg i chatten, og snup den med ét tryk.</p>
          </div>
          <div>
            <h2>Køb</h2>
            <ul>
              <li><Link href="/live">Live nu</Link></li>
              <li><Link href="/til-salg">Til salg</Link></li>
              <li><Link href="/kategori">Kategorier</Link></li>
              <li><Link href="/saadan-virker-det">Sådan virker det</Link></li>
              <li><Link href="/kurv">Mine snup</Link></li>
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
              <li><Link href="/faq">Spørgsmål og svar</Link></li>
              <li><Link href="/saadan-virker-det#tryg-handel">Tryg handel</Link></li>
              <li><Link href="/privatliv">Privatlivspolitik</Link></li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} snuplive.dk · Køb og sælg brugt live</span>
          <span>Fotos: Pexels</span>
        </div>
      </div>
    </footer>
  );
}
