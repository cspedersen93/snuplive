import type { Metadata } from "next";
import Link from "next/link";
import InstallGuide from "@/components/app/InstallGuide";

export const metadata: Metadata = {
  title: { absolute: "Hent Relived som app på iPhone og Android | Relived" },
  description:
    "Læg Relived på hjemmeskærmen på din iPhone, Android eller computer. Gratis, uden App Store, og med besked, når dine sælgere går live.",
  alternates: { canonical: "/app" },
};

const WHY = [
  { h: "Ét tryk fra hjemmeskærmen", p: "Relived åbner i fuld skærm som en app, uden adresselinje." },
  { h: "Besked, når de går live", p: "Få besked på telefonen, når dem, du følger, går live, eller din søgeagent finder noget." },
  { h: "Altid den nyeste udgave", p: "Appen opdaterer sig selv. Du skal aldrig hente noget i App Store eller Google Play." },
  { h: "Fylder næsten ingenting", p: "Den fylder kun en brøkdel af en almindelig app på telefonen." },
];

export default function AppSide() {
  return (
    <>
      <section className="phero" aria-labelledby="h-app">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Hent appen</span>
          </nav>
          <span className="label red">Gratis</span>
          <h1 className="h1" id="h-app">Hent Relived som app</h1>
          <p className="lede">
            Læg Relived på hjemmeskærmen, så er du ét tryk fra næste live-show. Det tager 10 sekunder og kræver ingen App Store.
          </p>
        </div>
      </section>

      <section className="sec tight" aria-label="Sådan henter du appen">
        <div className="wrap install-wrap">
          <InstallGuide />
          <ul className="install-why">
            {WHY.map((w) => (
              <li key={w.h}>
                <b>{w.h}</b>
                <span className="muted">{w.p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
