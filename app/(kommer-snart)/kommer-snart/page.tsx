import type { Metadata } from "next";
import { Suspense } from "react";
import PhoneMock from "@/components/PhoneMock";
import { SITE_URL } from "@/lib/env";
import WaitlistForm from "./WaitlistForm";

export const metadata: Metadata = {
  title: { absolute: "SnupLive – live shopping med second hand åbner snart" },
  description:
    "Køb og sælg brugt tøj, design og samleobjekter live på video. Skriv dig op til SnupLive, og få besked, så snart vi åbner.",
  alternates: { canonical: "/" },
  openGraph: { title: "Køb og sælg second hand live – SnupLive åbner snart", url: "/" },
};

const POINTS = [
  { h: "Se det live", p: "Sælgeren viser mærke, mål og slid på video, og du kan spørge løs i chatten." },
  { h: "Snup med ét tryk", p: "Den første, der trykker, får tingen. Eller byd med, når der er budsalg." },
  { h: "Tryg betaling", p: "Sælgeren får først pengene, når du har fået dine ting." },
];

/** Forsiden, mens SnupLive er lukket: hvad det er, og tilmelding til ventelisten. */
export default function KommerSnart() {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "SnupLive", url: `${SITE_URL}/`, logo: `${SITE_URL}/img/logo.png` },
      { "@type": "WebSite", name: "SnupLive", url: `${SITE_URL}/`, inLanguage: "da-DK" },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="hero soon-hero" aria-labelledby="h-soon">
        <div className="wrap">
          <div className="hero-copy">
            <span className="eyebrow label">
              <span className="live-dot" aria-hidden="true" />
              Åbner snart
            </span>
            <h1 id="h-soon" className="hero-h1">
              Køb og sælg second hand <em className="s">live</em>
            </h1>
            <p className="lede">
              Se tingen på video, spørg sælgeren i chatten, og snup den med ét tryk. Skriv dig op, så får du besked, når SnupLive åbner.
            </p>
            <Suspense fallback={null}>
              <WaitlistForm />
            </Suspense>
          </div>
          <PhoneMock />
        </div>
      </section>

      <section className="sec" aria-labelledby="h-soon-how">
        <div className="wrap">
          <h2 className="h2" id="h-soon-how" style={{ marginBottom: 28 }}>Hvordan virker SnupLive?</h2>
          <div className="soon-points">
            {POINTS.map((x, i) => (
              <div key={x.h}>
                <span className="soon-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <h3>{x.h}</h3>
                <p className="muted">{x.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec tight" style={{ paddingTop: 0 }} aria-labelledby="h-soon-saelg">
        <div className="wrap">
          <article className="panel img sell-panel soon-sell">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/sell-phone.jpg" alt="Telefon på stativ med ringlys filmer en sælger, der viser en kjole" loading="lazy" />
            <span className="label red">Til sælgere</span>
            <h2 className="h2" id="h-soon-saelg" style={{ maxWidth: "16ch" }}>Vil du være en af de første sælgere?</h2>
            <p style={{ maxWidth: 520, color: "rgba(246,240,235,.88)" }}>
              Gå live fra stuen, og sælg en hel bunke tøj, design eller samleobjekter på én aften. Skriv dig op som sælger, så kontakter vi dig før åbningen.
            </p>
            <a className="btn btn-red" href="?rolle=saelger#tilmeld">Skriv mig op som sælger</a>
          </article>
        </div>
      </section>
    </>
  );
}
