"use client";

import { useEffect, useRef, useState } from "react";

const HINT_KEY = "relived-swipe-ok";

/**
 * Kortet nederst på kameraet i studiet ("Vises nu"). Swipe til venstre for næste ting og til højre for den forrige,
 * eller tryk på pilene. Knappen "Vis næste" under kameraet virker som før.
 */
export default function SwipeCard({
  children,
  onNext,
  onPrev,
  canNext,
  canPrev,
  nextName,
  prevName,
}: {
  children: React.ReactNode;
  onNext: () => void;
  onPrev: () => void;
  canNext: boolean;
  canPrev: boolean;
  nextName: string | null;
  prevName: string | null;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(false);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);

  useEffect(() => {
    try {
      setHint(localStorage.getItem(HINT_KEY) !== "1");
    } catch {
      setHint(true);
    }
  }, []);

  function used() {
    if (!hint) return;
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Det gør ikke noget
    }
  }

  function go(dir: "next" | "prev") {
    if (dir === "next" && canNext) {
      used();
      onNext();
    } else if (dir === "prev" && canPrev) {
      used();
      onPrev();
    }
  }

  // Pil venstre/højre på computeren (ikke mens man skriver).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]") || e.altKey || e.metaKey || e.ctrlKey)) return;
      if (e.key === "ArrowRight") go("next");
      else if (e.key === "ArrowLeft") go("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function down(e: React.PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, active: false };
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        d.active = true;
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else if (Math.abs(my) > 12) {
        drag.current = null;
        return;
      } else return;
    }
    // Kan man ikke skifte den vej, giver kortet kun lidt efter.
    const allowed = mx < 0 ? canNext : canPrev;
    setDx(allowed ? mx : mx * 0.25);
  }
  function up(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    setDx(0);
    if (!d?.active) return;
    const mx = e.clientX - d.x;
    if (mx < -50) go("next");
    else if (mx > 50) go("prev");
  }
  function cancel() {
    drag.current = null;
    setDragging(false);
    setDx(0);
  }

  const peek = dx < -24 && canNext ? `Næste: ${nextName ?? ""}` : dx > 24 && canPrev ? `Forrige: ${prevName ?? ""}` : null;

  return (
    <>
      {hint && (canNext || canPrev) ? <div className="v-swipe-hint" aria-hidden="true">Swipe for at skifte vare</div> : null}
      {peek ? <div className={`v-swipe-peek ${dx < 0 ? "next" : "prev"}`} aria-hidden="true">{peek}</div> : null}
      <div
        className={`v-card v-swipe${dragging ? " dragging" : ""}`}
        style={dx ? { transform: `translateX(${dx}px)`, opacity: Math.max(0.4, 1 - Math.abs(dx) / 400) } : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
      >
        <button className="v-arrow prev" type="button" onClick={() => go("prev")} disabled={!canPrev} aria-label={prevName ? `Vis forrige vare: ${prevName}` : "Ingen forrige vare"}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        {children}
        <button className="v-arrow next" type="button" onClick={() => go("next")} disabled={!canNext} aria-label={nextName ? `Vis næste vare: ${nextName}` : "Ingen næste vare"}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  );
}
