"use client";

import { useEffect, useRef, useState } from "react";

/** Det klip, der afspilles lige nu (stopper det), så der kun er ét ad gangen. */
let current: (() => void) | null = null;

/**
 * Varens klip på varekortet: afspilles uden lyd, når musen holdes over kortet (computer),
 * eller når kortet er midt på skærmen (telefon). Videoen hentes først, når den skal afspilles.
 * Ingen afspilning ved "reducer bevægelse" eller datasparer.
 */
export default function ClipPreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const v = ref.current;
    const card = v?.closest(".icard");
    if (!v || !card) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (calm || saveData) return;
    const stop = () => {
      v.pause();
      setOn(false);
      if (current === stop) current = null;
    };
    const play = () => {
      // Kun ét klip ad gangen på siden.
      if (current && current !== stop) current();
      current = stop;
      if (!v.src) v.src = src;
      v.play().then(() => setOn(current === stop)).catch(() => {});
    };
    if (window.matchMedia?.("(hover: hover)").matches) {
      card.addEventListener("pointerenter", play);
      card.addEventListener("pointerleave", stop);
      return () => {
        card.removeEventListener("pointerenter", play);
        card.removeEventListener("pointerleave", stop);
      };
    }
    // Telefon: kun det kort, der står midt på skærmen.
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? play() : stop()), { rootMargin: "-35% 0px -35% 0px", threshold: 0.5 });
    io.observe(card);
    return () => io.disconnect();
  }, [src]);

  return <video ref={ref} className={`icard-clip${on ? " on" : ""}`} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />;
}
