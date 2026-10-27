import type { Metadata } from "next";
import Link from "next/link";
import { IconCamera, IconChat, IconShield, IconShieldCheck, IconStar, IconUser } from "@/components/Icons";
import ShowCard from "@/components/ShowCard";
import SupportLink from "@/components/SupportLink";
import { COMPANY } from "@/lib/company";
import { DELIVERY } from "@/lib/pricing";
import { fetchEnglishShows } from "@/lib/queries";
import { paymentsAreTest } from "@/lib/stripe";

// Relived på engelsk: én side til engelsktalende i Danmark. Resten af siden er på dansk (browseren kan oversætte).
// Shows, sælgerne har markeret som engelske (0023_engelsk.sql), står øverst.

export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "Relived in English – buy second hand live in Denmark" },
  description:
    "Buy and sell second hand clothes and things live on video in Denmark. Watch, ask the seller in the chat, and buy with one tap. Shows in English too.",
  alternates: { canonical: "/en", languages: { "da-DK": "/", en: "/en" } },
  openGraph: { title: "Relived in English – second hand you can see live", locale: "en_GB", url: "/en" },
};

/** Danske ord, man møder på siden. */
const WORDS: [string, string][] = [
  ["Live nu", "Live now"],
  ["Til salg", "For sale"],
  ["Køb", "Buy"],
  ["Køb nu", "Buy now (fixed price)"],
  ["Budsalg", "Auction"],
  ["Byd", "Bid"],
  ["Lynrunde", "Flash round: 10 seconds to buy"],
  ["Husk mig", "Remind me"],
  ["Følg", "Follow"],
  ["Mine køb", "My purchases"],
  ["Meld et problem", "Report a problem"],
  ["Sælg", "Sell"],
];

export default async function English() {
  const shows = await fetchEnglishShows(10);
  const test = paymentsAreTest();
  return (
    <div lang="en">
      <section className="phero" aria-labelledby="h-en">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumbs">
            <Link href="/" lang="da">Forside</Link>
            <span aria-hidden="true">/</span>
            <span>In English</span>
          </nav>
          <span className="label red">Relived in English</span>
          <h1 className="h1" id="h-en">
            Second hand you can see <em className="s">live</em> before you buy
          </h1>
          <p className="lede">
            Relived is a Danish marketplace where sellers show their things on live video. Ask anything in the chat, buy with one
            tap, and the seller only gets paid once you have the item.
          </p>
          <div className="ctas">
            <Link className="btn btn-red" href="/live">See who&apos;s live</Link>
            <a className="btn btn-line" href="#shows">Shows in English</a>
          </div>
          <ul className="points" style={{ marginTop: 22 }}>
            <li>The seller is paid only once you have the item</li>
            <li>Delivery to a pickup point for {DELIVERY.ship.price} kr</li>
            <li>No app needed</li>
          </ul>
          {test ? (
            <p className="fine" style={{ marginTop: 18 }}>
              Relived is in a test phase. No real money is charged, and nothing is shipped. At checkout you&apos;ll see a test card
              number you can use.
            </p>
          ) : null}
        </div>
      </section>

      <section className="sec tight" id="shows" aria-labelledby="h-en-shows">
        <div className="wrap">
          <div className="row-head">
            <h2 className="h2" id="h-en-shows">Shows in English</h2>
            <Link className="btn btn-line" href="/live">All shows</Link>
          </div>
          {shows.length ? (
            <div className="cards-scroll">
              <div className="cards">
                {shows.map((s, i) => (
                  <ShowCard key={s.id} show={s} priority={i < 2} />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty">
              <p style={{ marginBottom: 14 }}>
                No shows in English right now. Most shows are in Danish, but most Danes speak English, so feel free to ask in English
                in the chat.
              </p>
              <Link className="btn btn-red" href="/live">See who&apos;s live</Link>
            </div>
          )}
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-en-how">
        <div className="wrap split" style={{ alignItems: "start" }}>
          <div className="sec-head">
            <h2 className="h2" id="h-en-how">How does buying live work?</h2>
            <p className="lede">Everything happens right here on the site, on your phone or your computer.</p>
          </div>
          <ol className="steps">
            <li><div><h3>Find a show</h3><p>See who&apos;s live, or tap Husk mig (Remind me) on a show that starts later, and we&apos;ll let you know when it starts.</p></div></li>
            <li><div><h3>Ask in the chat</h3><p>Ask the seller to show the label, the measurements or any wear up close. You get the answer while you watch.</p></div></li>
            <li><div><h3>Buy or bid</h3><p>The first to tap Køb (Buy) gets it. In a Budsalg (auction) you have 30 seconds to bid, and the highest bid wins.</p></div></li>
            <li><div><h3>Pay in one go</h3><p>Pay for everything under Mine køb (My purchases) within 3 days with MobilePay, card, Apple Pay or Google Pay. Everything from the same seller ships in one parcel.</p></div></li>
            <li><div><h3>Pick it up</h3><p>Collect your parcel at a DAO or GLS pickup point, or pick the item up from the seller. Once you confirm that everything is fine, the seller gets paid.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-en-words">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="h2" id="h-en-words">Danish words you&apos;ll see</h2>
            <p className="lede">
              The rest of Relived is in Danish. Your browser can translate it for you, and these are the words you&apos;ll meet most.
            </p>
          </div>
          <dl className="en-words">
            {WORDS.map(([da, en]) => (
              <div key={da}>
                <dt lang="da">{da}</dt>
                <dd>{en}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="sec band" aria-labelledby="h-en-safe">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="h2" id="h-en-safe">Is it safe to buy live?</h2>
          </div>
          <div className="feat">
            <div><IconShield /><h3>Your money is held</h3><p>The seller only gets paid once you have the item, and you can track the parcel all the way.</p></div>
            <div><IconCamera /><h3>You see it live</h3><p>Ask to see the label, the measurements and the condition up close before you buy.</p></div>
            <div><IconStar /><h3>Seller ratings</h3><p>After every order the buyer can rate the seller, so you can see who you&apos;re buying from.</p></div>
            <div><IconShieldCheck className="ico" /><h3>Designer items are checked</h3><p>Designer bags, watches and other luxury brands are checked for authenticity by Relived before they can be bought. If an item turns out to be fake, you get all your money back.</p></div>
            <div><IconChat /><h3>Help if something goes wrong</h3><p>Tap Meld et problem (Report a problem) on your order before the seller is paid. We hold the money and help you find a solution.</p></div>
            <div><IconUser className="ico" /><h3>Verified sellers</h3><p>At launch, every seller is verified with MitID, the Danish digital ID, before they can sell.</p></div>
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="h-en-know">
        <div className="wrap split" style={{ alignItems: "start" }}>
          <div className="sec-head">
            <h2 className="h2" id="h-en-know">Good to know</h2>
          </div>
          <ul className="sort-list">
            <li><b>Prices</b> are in Danish kroner (kr).</li>
            <li><b>Delivery</b> is to DAO and GLS pickup points in Denmark, {DELIVERY.ship.price} kr per seller for up to 5 kg. Picking up from the seller is free.</li>
            <li><b>Buyer protection</b> is 5 % of the items + 5 kr per parcel. You see the total before you pay.</li>
            <li><b>Our terms and privacy policy</b> are in Danish, and the Danish versions apply: <Link href="/handelsbetingelser" lang="da">Handelsbetingelser</Link>, <Link href="/vilkaar" lang="da">Vilkår</Link> and <Link href="/privatliv" lang="da">Privatlivspolitik</Link>.</li>
          </ul>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }} aria-labelledby="h-en-sell">
        <div className="wrap">
          <div className="cta-band">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 className="h2" id="h-en-sell">Speak English? Sell in English.</h2>
              <p className="lede" style={{ margin: 0, maxWidth: 620 }}>
                Go live from your phone, show your things one by one, and sell a whole pile in one evening. Tick <b>Showet er på
                engelsk</b> (The show is in English) when you create your show, and it gets the English badge and shows up on this
                page. Selling is free during the beta.
              </p>
            </div>
            <div className="ctas">
              <Link className="btn btn-red" href="/opret">Create a free account</Link>
              <Link className="btn btn-line" href="/saelg" lang="da">Sælg live (Danish)</Link>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 22 }}>
            Questions? <SupportLink className="sup-link inline">Write to us in the chat</SupportLink> or at{" "}
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. We answer in English too.
          </p>
        </div>
      </section>
    </div>
  );
}
