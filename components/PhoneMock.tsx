import { IconEye, IconHeart, IconShare } from "@/components/Icons";

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
          <div className="rail">
            <span><IconHeart />2.418</span>
            <span><IconShare />Del</span>
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
