"use client";

import { useEffect, useRef, useState } from "react";

const WEBM = "/video/welcome-live.webm";
const MP4 = "/video/welcome-live.mp4";
const POSTER = "/img/welcome-live-poster.jpg";

/**
 * Videoen i det store kort på forsiden, når ingen er live: en sælger viser varer frem i stuen. Uden lyd og i ring.
 * Den hentes først, når kortet kan ses, og spiller ikke for folk, der har bedt om mindre bevægelse eller sparer data.
 * Der er en knap til at stoppe den.
 */
export default function WelcomeVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  // Filerne hentes først, når kortet kan ses.
  const [src, setSrc] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (calm || saveData) return; // kun billedet
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSrc(true);
          if (!stopped && v.currentSrc) void v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [stopped]);

  useEffect(() => {
    // Når kilderne er sat ind, indlæses videoen og starter, medmindre den er stoppet.
    const v = ref.current;
    if (!v || !src) return;
    if (!v.currentSrc) v.load();
    if (!stopped) void v.play().catch(() => {});
  }, [src, stopped]);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setStopped(true);
    } else {
      setStopped(false);
      if (!src) setSrc(true);
      void v.play().catch(() => {});
    }
  }

  return (
    <>
      <video
        ref={ref}
        className="ftile-img"
        poster={POSTER}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        {/* MP4 først (Safari og iPhone), WebM til browsere uden MP4-afspilning. */}
        {src ? <source src={MP4} type="video/mp4" /> : null}
        {src ? <source src={WEBM} type="video/webm" /> : null}
      </video>
      {src ? (
        <button className="ftile-vbtn" type="button" onClick={toggle} aria-label={playing ? "Stop videoen" : "Afspil videoen"}>
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
              <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" />
            </svg>
          )}
        </button>
      ) : null}
    </>
  );
}
