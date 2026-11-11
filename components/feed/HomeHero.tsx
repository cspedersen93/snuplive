"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

const WEBM = "/video/welcome-live-v2.webm";
const MP4 = "/video/welcome-live-v2.mp4";
const POSTER = "/img/welcome-live-poster-v2.jpg";

type Msg = { name: string; text: string; kind?: "seller" | "me" };

/** Eksemplet i chatten. Det er ikke rigtige brugere, og kortet er mærket "Eksempel på et show". */
const SCRIPT: Msg[] = [
  { name: "mette_k", text: "Er remmen med?" },
  { name: "Sælger", text: "Ja, og den kan tages af.", kind: "seller" },
  { name: "jonas", text: "Hvad måler den?" },
  { name: "Sælger", text: "32 × 24 cm. Der er plads til en bærbar.", kind: "seller" },
  { name: "sara_b", text: "Er der slid på hjørnerne?" },
  { name: "Sælger", text: "Jeg holder dem lige op til kameraet.", kind: "seller" },
];

/**
 * Toppen af forsiden: overskrift og knapper til venstre, og til højre et eksempel på et show, man kan prøve:
 * videoen kører, chatten ruller, og "Køb nu" viser, hvad der sker, når man køber. Intet her er et rigtigt køb.
 * På telefonen ligger showet øverst, og chatten ligger hen over videoen som i et rigtigt show.
 */
export default function HomeHero({
  liveHref,
  liveCount,
  free = false,
  nextCard,
  children,
}: {
  liveHref: string;
  liveCount: number;
  /** Kører gratis-kampagnen (0 kr i gebyr)? */
  free?: boolean;
  /** Kortet med næste show (kun på brede skærme). */
  nextCard?: ReactNode;
  /** Noter under knapperne (gratis-kampagnen og genbrugstælleren). */
  children?: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>(SCRIPT.slice(0, 2));
  const next = useRef(2);
  const [bought, setBought] = useState(false);
  const [draft, setDraft] = useState("");
  // Hjerterne, der stiger op i højre side, som i et rigtigt show. Kun de seneste bliver tegnet.
  const [hearts, setHearts] = useState<number[]>([]);
  const heartId = useRef(0);
  const addHeart = () => {
    heartId.current += 1;
    const id = heartId.current;
    setHearts((cur) => [...cur, id].slice(-7));
  };

  useEffect(() => {
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (calm) return; // stillbillede og stille chat
    if (!saveData) void video.current?.play().catch(() => {});
    const t = window.setInterval(() => {
      if (document.hidden) return;
      const m = SCRIPT[next.current % SCRIPT.length];
      next.current += 1;
      setMsgs((cur) => [...cur, m].slice(-4));
    }, 2600);
    const h = window.setInterval(() => {
      if (!document.hidden) addHeart();
    }, 1700);
    return () => {
      window.clearInterval(t);
      window.clearInterval(h);
    };
  }, []);

  function send(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setMsgs((cur) => [...cur, { name: "Dig", text: t, kind: "me" as const }].slice(-4));
    setDraft("");
  }

  return (
    <div className="hh">
      <div className="hh-copy">
        {liveCount ? (
          <Link className="label red feed-eyebrow" href={liveHref}>
            <span className="live-dot" aria-hidden="true" />
            {`${liveCount} ${liveCount === 1 ? "sælger er" : "sælgere er"} live nu`}
          </Link>
        ) : (
          <span className="label brass feed-eyebrow">Live Sale · Second Hand</span>
        )}
        <h1 id="h-forside" className="hh-h1">
          Second hand uden gætterier. <span className="hh-dim">Se varen <em className="s">live</em>, og spørg sælgeren.</span>
        </h1>
        <p className="hh-lede">
          Sælgeren viser varen frem på video. Du spørger i chatten og køber med ét tryk. Pengene holdes tilbage, til du har
          varen i hånden.
        </p>
        <div className="hh-cta">
          <Link className="btn btn-red hh-main" href={liveHref}>
            <span className="live-dot white" aria-hidden="true" />
            <span className="hh-long">Se hvem der er live</span>
            <span className="hh-short">Se live nu</span>
          </Link>
          <Link className="btn btn-line" href="/saelg">Sælg dine varer</Link>
        </div>
        <ul className="hh-trust">
          {free ? <li>0 kr i gebyr for køber og sælger</li> : null}
          <li>Beskyttet betaling</li>
          {free ? null : <li>Gratis at sælge i beta</li>}
          <li className="hh-wide">Ingen app, det hele sker på siden</li>
        </ul>
        {children}
      </div>

      <div className="hp-stage" aria-label="Eksempel på et show">
        <div className="hp-phone">
          <span className="hp-key k1" aria-hidden="true" />
          <span className="hp-key k2" aria-hidden="true" />
          <span className="hp-key k3" aria-hidden="true" />
          <div className="hp-screen">
            <video ref={video} muted loop playsInline preload="metadata" poster={POSTER} aria-label="En sælger viser en lædertaske frem til telefonen på stativet">
              <source src={WEBM} type="video/webm" />
              <source src={MP4} type="video/mp4" />
            </video>
            <span className="hp-island" aria-hidden="true" />
            <div className="hp-badges">
              <span className="hh-live"><span className="live-dot white" aria-hidden="true" />LIVE</span>
              <span className="hh-ex">Eksempel på et show</span>
            </div>
            <div className="hp-hearts" aria-hidden="true">
              {hearts.map((h) => (
                <span key={h} className={`hp-heart v${h % 3}`}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.300C.5 8.200 2.300 4.500 6 4.500c2.100 0 3.600 1.200 4.500 2.500h3c.9-1.300 2.400-2.500 4.500-2.500 3.700 0 5.500 3.700 4 7.200C19.500 16.400 12 21 12 21z" /></svg>
                </span>
              ))}
            </div>
            <div className="hp-bottom">
              <div className="hp-msgs" aria-hidden="true">
                {msgs.slice(-3).map((m, i) => (
                  <span key={`${next.current}-${i}`} className="hp-msg"><b className={m.kind ?? ""}>{m.name}</b> {m.text}</span>
                ))}
              </div>
              <div className="hp-buy">
                <div className="hh-buy-t" aria-live="polite">
                  {bought ? (
                    <>
                      <b className="hh-done">Den er din</b>
                      <small>Sådan er det at købe i et show</small>
                    </>
                  ) : (
                    <>
                      <small>Lædertaske, cognac</small>
                      <b className="hh-price">350 kr</b>
                    </>
                  )}
                </div>
                {bought ? (
                  <button type="button" className="btn btn-line btn-sm" onClick={() => setBought(false)}>Prøv igen</button>
                ) : (
                  <button type="button" className="btn btn-red" onClick={() => setBought(true)}>Køb nu</button>
                )}
              </div>
              <form className="hp-form" onSubmit={send}>
                <label className="sr-only" htmlFor="hh-q">Stil et spørgsmål (eksempel)</label>
                <input id="hh-q" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Stil et spørgsmål" autoComplete="off" maxLength={80} />
                <button type="button" className="hp-like" aria-label="Send et hjerte (eksempel)" onClick={addHeart}>
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.400-7-10a4 4 0 0 1 7-2.400A4 4 0 0 1 19 10c0 5.600-7 10-7 10z" /></svg>
                </button>
              </form>
            </div>
          </div>
        </div>

        {nextCard ? <div className="hp-next">{nextCard}</div> : null}
      </div>
    </div>
  );
}
