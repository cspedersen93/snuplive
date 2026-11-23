"use client";

import { useEffect, useState } from "react";

/** "om 1 dag og 3 timer", "om 2 t 15 min", "om 12 min". Tom, til browseren har regnet tiden ud (serveren kender ikke klokken hos dig). */
export function untilText(ms: number) {
  if (ms <= 0) return "starter nu";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "om et øjeblik";
  if (min < 60) return `om ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `om ${h} t ${min % 60} min` : `om ${h} t`;
  const d = Math.floor(h / 24);
  const dage = d === 1 ? "1 dag" : `${d} dage`;
  if (d >= 3 || h % 24 === 0) return `om ${dage}`;
  return `om ${dage} og ${h % 24} ${h % 24 === 1 ? "time" : "timer"}`;
}

/** Nedtælling til et tidspunkt. Opdateres hvert halve minut. */
export default function Countdown({ to, className }: { to: string; className?: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => setText(untilText(new Date(to).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [to]);
  return (
    <span className={className} aria-live="off">
      {text}
    </span>
  );
}
