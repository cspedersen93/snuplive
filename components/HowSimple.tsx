"use client";

import Link from "next/link";
import { useState } from "react";

type Step = { icon: "play" | "chat" | "tap" | "camera" | "phone" | "box"; title: string; text: string };

const BUY: Step[] = [
  { icon: "play", title: "Se med", text: "Vælg et show. Sælgeren viser varerne frem på video, én ad gangen." },
  { icon: "chat", title: "Spørg", text: "I tvivl om størrelse eller stand? Skriv i chatten, og få svar med det samme." },
  { icon: "tap", title: "Tryk Køb", text: "Betal med kort eller MobilePay. Sælgeren får først pengene, når du har varen." },
];
const SELL: Step[] = [
  { icon: "camera", title: "Læg varerne ind", text: "Tag et billede af hver vare, og sæt en pris. Vælg, hvornår dit show starter." },
  { icon: "phone", title: "Gå live", text: "Åbn siden på telefonen, og vis varerne frem. Køberne spørger og køber undervejs." },
  { icon: "box", title: "Send, og få pengene", text: "Køberen betaler fragten. Du får pengene, når køberen har fået varen." },
];

const PATHS: Record<Step["icon"], React.ReactNode> = {
  play: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.500v5l4.500-2.500z" /></>,
  chat: <><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 4v-4H6a2 2 0 0 1-2-2z" /><path d="M8.500 10h7" /></>,
  tap: <><path d="M9 11V5.500a1.500 1.500 0 0 1 3 0V11" /><path d="M12 10.500V9a1.500 1.500 0 0 1 3 0v2" /><path d="M15 11a1.500 1.500 0 0 1 3 0v3.500c0 3-2 5.500-5 5.500s-4.200-1.300-5.500-3.500L6 14a1.400 1.400 0 0 1 2.300-1.600L9 13.500" /></>,
  camera: <><path d="M4 8a2 2 0 0 1 2-2h2l1.500-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.500" r="3.200" /></>,
  phone: <><rect x="7" y="2.500" width="10" height="19" rx="2.500" /><path d="M11 18.500h2" /></>,
  box: <><path d="M3.500 8L12 3.500 20.500 8v8L12 20.500 3.500 16z" /><path d="M3.500 8L12 12.500 20.500 8M12 12.500v8" /></>,
};

/**
 * "Sådan gør du" i tre trin, så enkelt som muligt: ét ord pr. trin og én sætning under.
 * Man vælger selv, om man vil købe eller sælge. Begge sæt trin står i HTML'en, så søgemaskiner læser dem.
 */
export default function HowSimple() {
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  return (
    <div className="hs">
      <div className="hs-tabs" role="tablist" aria-label="Vil du købe eller sælge?">
        <button type="button" role="tab" id="hs-tab-buy" aria-selected={mode === "buy"} aria-controls="hs-buy" onClick={() => setMode("buy")}>Jeg vil købe</button>
        <button type="button" role="tab" id="hs-tab-sell" aria-selected={mode === "sell"} aria-controls="hs-sell" onClick={() => setMode("sell")}>Jeg vil sælge</button>
      </div>
      {(["buy", "sell"] as const).map((m) => (
        <div key={m} id={`hs-${m}`} role="tabpanel" aria-labelledby={`hs-tab-${m}`} hidden={mode !== m}>
          <ol className="hs-steps">
            {(m === "buy" ? BUY : SELL).map((s, i) => (
              <li key={s.title}>
                <span className="hs-ico" aria-hidden="true">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round">{PATHS[s.icon]}</svg>
                </span>
                <span className="hs-num" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="hs-cta">
            {m === "buy" ? (
              <>
                <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
                <Link className="btn btn-line" href="/saadan-virker-det">Læs det hele</Link>
              </>
            ) : (
              <>
                <Link className="btn btn-red" href="/saelg">Bliv sælger</Link>
                <Link className="btn btn-line" href="/guides">Se guides til sælgere</Link>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
