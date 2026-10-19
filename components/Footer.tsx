import Link from "next/link";

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
            <p>Live shopping med brugte ting. Sælgerne går live på video, og du chatter med og snupper det, du kan lide.</p>
          </div>
          <div>
            <h2>Køb</h2>
            <ul>
              <li><Link href="/live">Live nu</Link></li>
              <li><Link href="/saadan-virker-det">Sådan køber du</Link></li>
              <li><Link href="/kurv">Mine snup</Link></li>
            </ul>
          </div>
          <div>
            <h2>Sælg</h2>
            <ul>
              <li><Link href="/saelg">Sælg live</Link></li>
              <li><Link href="/opret">Opret konto</Link></li>
              <li><Link href="/studio">Gå live</Link></li>
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
          <span>© {new Date().getFullYear()} snuplive.dk · Live shopping med brugte ting</span>
          <span>Fotos: Pexels</span>
        </div>
      </div>
    </footer>
  );
}
