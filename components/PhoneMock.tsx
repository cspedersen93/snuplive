import { IconEye, IconHeart, IconSmilePlus } from "@/components/Icons";

// Hjerter og emojis, der svæver op hele tiden (samme udseende som i et rigtigt show, se components/Reactions.tsx).
const DEMO = [
  { c: "#EB0029", x0: 0, x1: -5, rot: -12, s: 7.5 },
  { c: "#FF8A9B", x0: 1.5, x1: 3, rot: 14, s: 6.5 },
  { e: "🔥", x0: -1, x1: -6, rot: -6, s: 7 },
  { c: "#FFFFFF", x0: 2, x1: -2, rot: 10, s: 6 },
  { c: "#F2C46B", x0: -2, x1: 2.5, rot: -16, s: 7 },
  { e: "😍", x0: 1, x1: -4, rot: 8, s: 7 },
  { c: "#FF5A70", x0: -1.5, x1: -7, rot: 16, s: 8 },
  { c: "#B9D9C6", x0: 0.5, x1: 1.5, rot: -10, s: 6.5 },
];

/** Stillbillede af et live-show til forsiden (ingen rigtig video). */
export default function PhoneMock() {
  return (
    <div className="stage">
      <div className="ring" aria-hidden="true" />
      <div
        className="phone"
        role="img"
        aria-label="Eksempel på et live-show: sælgeren holder en trenchcoat op til kameraet, seerne skriver i chatten, og frakken kan købes med ét tryk"
      >
        <div className="island" />
        <div className="screen" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="feed" src="/img/live-feed.jpg" alt="" />
          <div className="shade" />
          <div className="v-top">
            <div className="v-seller">
              <span className="ava" style={{ background: "linear-gradient(135deg,#F4AC94,#C46E8A)" }}>M</span>
              <span className="v-who">majasgarderobe<small>Nørrebro</small></span>
              <span className="v-follow">Følg</span>
            </div>
            <div className="v-badges">
              <span className="b-live"><span className="live-dot white" />LIVE</span>
              <span className="b-view"><IconEye />214</span>
            </div>
          </div>
          <div className="rx rx-viewer rx-demo">
            <div className="rx-stream">
              {DEMO.map((p, i) => (
                <span key={i} className="rx-p" style={{ ["--dur" as string]: "3.2s", ["--delay" as string]: `${-i * 0.4}s` }}>
                  <span
                    className="rx-p-in"
                    style={{
                      ["--s" as string]: `${p.s}cqw`,
                      ["--x0" as string]: `${p.x0}cqw`,
                      ["--x1" as string]: `${p.x1}cqw`,
                      ["--rot" as string]: `${p.rot}deg`,
                      color: p.c,
                    }}
                  >
                    {p.e ? <span className="rx-emoji">{p.e}</span> : <IconHeart fill="currentColor" />}
                  </span>
                </span>
              ))}
            </div>
            <div className="rx-rail">
              <span className="rx-btn rx-heart"><IconHeart /></span>
              <span className="rx-btn rx-more"><IconSmilePlus /></span>
            </div>
          </div>
          <div className="v-chat">
            <div className="msg" style={{ ["--c" as string]: "#9DB4E0" }}><i /><div><b>liva.k</b>Hvor lang er frakken?</div></div>
            <div className="msg seller" style={{ ["--c" as string]: "linear-gradient(135deg,#F4AC94,#C46E8A)" }}><i /><div><b>majasgarderobe</b>98 cm fra skulderen 🙌</div></div>
            <div className="msg" style={{ ["--c" as string]: "#B9D9C6" }}><i /><div><b>ole_k</b>Kan du vende den?</div></div>
            <div className="msg event">liva.k købte Strikvest for 80 kr</div>
          </div>
          <div className="v-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/live-thumb.jpg" alt="" />
            <div style={{ minWidth: 0 }}>
              <div className="v-pin">Vises nu</div>
              <div className="v-name">Trenchcoat, beige</div>
              <div className="v-meta">Str. M · Som ny</div>
            </div>
            <span className="v-buy">Køb 350 kr</span>
          </div>
        </div>
      </div>
    </div>
  );
}
