"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const WEBM = "/video/welcome-live-v2.webm";
const MP4 = "/video/welcome-live-v2.mp4";
// Lille stillbillede i samme format som videoen, så telefonen ikke står tom, før videoen er hentet.
const POSTER = "/img/welcome-live-poster-960.webp";

type Msg = { name: string; text: string; kind?: "seller" | "me" };

/** Eksemplet i chatten. Det er ikke rigtige brugere, og telefonen er mærket "Eksempel på et show". */
const SCRIPT: Msg[] = [
  { name: "mette_k", text: "Er remmen med?" },
  { name: "Sælger", text: "Ja, og den kan tages af.", kind: "seller" },
  { name: "jonas", text: "Hvad måler den?" },
  { name: "Sælger", text: "32 × 24 cm. Der er plads til en bærbar.", kind: "seller" },
  { name: "sara_b", text: "Er der slid på hjørnerne?" },
  { name: "Sælger", text: "Jeg holder dem lige op til kameraet.", kind: "seller" },
];

/**
 * Et eksempel på et show, vist i en telefon: videoen kører, chatten ruller, hjerter stiger op, og "Køb nu" viser,
 * hvad der sker, når man køber. Intet her er et rigtigt køb. Videoen og chatten kører kun, mens telefonen er i
 * billedet, og står stille for dem, der har bedt om mindre bevægelse.
 */
export default function ShowPhone() {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>(SCRIPT.slice(0, 2));
  const next = useRef(2);
  const [bought, setBought] = useState(false);
  const [draft, setDraft] = useState("");
  const [hearts, setHearts] = useState<number[]>([]);
  const heartId = useRef(0);
  const addHeart = () => {
    heartId.current += 1;
    const id = heartId.current;
    setHearts((cur) => [...cur, id].slice(-7));
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (calm) return; // stillbillede og stille chat
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    let seen = false;
    const io = new IntersectionObserver(
      ([e]) => {
        seen = e.isIntersecting;
        const v = video.current;
        if (!v) return;
        if (seen && !saveData) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    const t = window.setInterval(() => {
      if (!seen || document.hidden) return;
      const m = SCRIPT[next.current % SCRIPT.length];
      next.current += 1;
      setMsgs((cur) => [...cur, m].slice(-4));
    }, 2600);
    const h = window.setInterval(() => {
      if (seen && !document.hidden) addHeart();
    }, 1700);
    return () => {
      io.disconnect();
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
    <div className="hp-stage" ref={root} aria-label="Eksempel på et show">
      <div className="hp-phone">
        <span className="hp-key k1" aria-hidden="true" />
        <span className="hp-key k2" aria-hidden="true" />
        <span className="hp-key k3" aria-hidden="true" />
        <div className="hp-screen">
          <video ref={video} muted loop playsInline preload="none" poster={POSTER} aria-label="En sælger viser en lædertaske frem til telefonen på stativet">
            <source src={WEBM} type="video/webm" />
            <source src={MP4} type="video/mp4" />
          </video>
          <span className="hp-island" aria-hidden="true" />
          <div className="hp-badges">
            <span className="hp-live"><span className="live-dot white" aria-hidden="true" />LIVE</span>
            <span className="hp-ex">Eksempel på et show</span>
          </div>
          <div className="hp-hearts" aria-hidden="true">
            {hearts.map((h) => (
              <span key={h} className={`hp-heart v${h % 3}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.400-7-10a4 4 0 0 1 7-2.400A4 4 0 0 1 19 10c0 5.600-7 10-7 10z" /></svg>
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
              <div className="hp-buy-t" aria-live="polite">
                {bought ? (
                  <>
                    <b className="hp-done">Den er din</b>
                    <small>Sådan er det at købe i et show</small>
                  </>
                ) : (
                  <>
                    <small>Lædertaske, cognac</small>
                    <b className="hp-price">350 kr</b>
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
              <label className="sr-only" htmlFor="hp-q">Stil et spørgsmål (eksempel)</label>
              <input id="hp-q" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Stil et spørgsmål" autoComplete="off" maxLength={80} />
              <button type="button" className="hp-like" aria-label="Send et hjerte (eksempel)" onClick={addHeart}>
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.400-7-10a4 4 0 0 1 7-2.400A4 4 0 0 1 19 10c0 5.600-7 10-7 10z" /></svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
