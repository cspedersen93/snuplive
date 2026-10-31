"use client";

import { useEffect, useRef, useState } from "react";
import { IconMute, IconPlay, IconSound } from "@/components/Icons";

/**
 * Billeder af tingen: ét stort og små under, man kan vælge imellem.
 * Har tingen et klip fra live-showet, vises det først (uden lyd, i loop; lyden kan slås til).
 */
export default function Gallery({
  images,
  alt,
  video,
  filmed = false,
}: {
  images: string[];
  alt: string;
  video?: string | null;
  /** Videoen er filmet til en videoannonce (ikke fra et live-show). */
  filmed?: boolean;
}) {
  const media = [...(video ? [{ kind: "video" as const, src: video }] : []), ...images.map((src) => ({ kind: "img" as const, src }))];
  const [i, setI] = useState(0);
  const cur = media[Math.min(i, media.length - 1)];
  return (
    <div className="gallery">
      <div className="gallery-main">
        {cur?.kind === "video" ? (
          <Clip src={cur.src} poster={images[0]} alt={alt} filmed={filmed} />
        ) : cur ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cur.src} alt={alt} />
        ) : null}
      </div>
      {media.length > 1 ? (
        <div className="gallery-thumbs" role="group" aria-label="Vælg billede eller video">
          {media.map((m, n) =>
            m.kind === "video" ? (
              <button
                key={m.src}
                type="button"
                className="thumb-video"
                onClick={() => setI(n)}
                aria-pressed={n === i}
                aria-label={filmed ? "Video af varen" : "Video fra live-showet"}
              >
                {images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[0]} alt="" />
                ) : null}
                <IconPlay />
              </button>
            ) : (
              <button key={m.src} type="button" onClick={() => setI(n)} aria-pressed={n === i} aria-label={`Billede ${n + (video ? 0 : 1)}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.src} alt="" />
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function Clip({ src, poster, alt, filmed }: { src: string; poster?: string; alt: string; filmed: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  // Afspiller af sig selv uden lyd, medmindre man har bedt om mindre bevægelse på sin enhed.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!still) v.play().catch(() => {});
  }, [src]);

  function toggleSound() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) v.play().catch(() => {});
  }

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  return (
    <>
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={`${alt}, ${filmed ? "video af varen" : "video fra live-showet"}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlay}
      />
      <span className="gallery-tag">
        <IconPlay />
        {filmed ? "Video" : "Fra live-showet"}
      </span>
      <div className="gallery-ctl">
        <button type="button" onClick={togglePlay} aria-label={playing ? "Sæt videoen på pause" : "Afspil videoen"}>
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <rect x="6.5" y="5" width="4" height="14" rx="1" />
              <rect x="13.5" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <IconPlay />
          )}
        </button>
        <button type="button" onClick={toggleSound} aria-label={muted ? "Slå lyden til" : "Slå lyden fra"} aria-pressed={!muted}>
          {muted ? <IconMute /> : <IconSound />}
        </button>
      </div>
    </>
  );
}
