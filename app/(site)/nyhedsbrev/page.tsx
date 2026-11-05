import type { Metadata } from "next";
import Link from "next/link";
import CampaignCards from "@/components/CampaignCards";
import NewsletterForm from "@/components/NewsletterForm";
import { campaignFlags } from "@/lib/campaignFlags";
import { campaignState } from "@/lib/campaigns";

// Teksten følger datoen (nedtælling og dagens låge), så siden bygges igen hvert 5. minut.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Nyhedsbrev: Green Friday og julekalender live",
  description:
    "Skriv dig op til nyhedsbrevet fra Relived, og få besked om Green Friday-showet 27. november, julekalenderen med 24 live-shows og ugens bedste fund.",
  alternates: { canonical: "/nyhedsbrev" },
};

export default async function Nyhedsbrev() {
  const flags = await campaignFlags();
  const { gf, jk, active } = campaignState(new Date(), flags);
  const title =
    gf.phase !== "over" && jk.phase !== "over"
      ? "Få besked om Green Friday og julekalenderen"
      : jk.phase !== "over"
        ? "Få besked om julekalenderen"
        : gf.phase !== "over"
          ? "Få besked om Green Friday"
          : "Få ugens live-shows i din indbakke";

  return (
    <>
      <section className="phero" aria-labelledby="h-nyhedsbrev">
        <div className="wrap">
          <nav className="crumbs" aria-label="Brødkrummer">
            <Link href="/">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>Nyhedsbrev</span>
          </nav>
          <h1 className="h1" id="h-nyhedsbrev">{title}</h1>
          <p className="lede">
            Skriv dig op til nyhedsbrevet. Så sender vi en mail, før de store shows starter, og ugens program, når der er nyt. Du kan
            altid afmelde dig med ét klik.
          </p>
          <NewsletterForm source="nyhedsbrev-side" />
        </div>
      </section>

      {active ? (
        <section className="sec" aria-labelledby="h-nyhedsbrev-kampagner">
          <div className="wrap">
            <h2 className="h2" id="h-nyhedsbrev-kampagner" style={{ marginBottom: 24 }}>Det sker på Relived</h2>
            <CampaignCards flags={flags} sellerLink />
          </div>
        </section>
      ) : null}

      <section className="sec tight" aria-labelledby="h-nyhedsbrev-faar">
        <div className="wrap">
          <h2 className="h2" id="h-nyhedsbrev-faar" style={{ marginBottom: 20 }}>Det får du i nyhedsbrevet</h2>
          <ul className="news-list">
            <li><span><b>Besked før de store shows</b>, så du kan trykke Husk mig og være med fra start.</span></li>
            <li><span><b>Ugens program</b> med de sælgere, der går live, og hvad de har med.</span></li>
            <li><span><b>De bedste fund</b> fra ugens shows, der stadig er til salg.</span></li>
          </ul>
          <p className="muted" style={{ marginTop: 18 }}>
            Har du selv noget, der skal videre? <Link href="/saelg">Se, hvordan du sælger live</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
