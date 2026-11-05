"use client";

import { useEffect, useState } from "react";
import type { Message } from "@/lib/types";

/**
 * Chatten med stor skrift oven på videoen i studiet, så sælgeren kan læse den på afstand med telefonen på en stander.
 * Kun seernes beskeder og køb/bud (ikke sælgerens egne). Spørgsmål får et gult mærke, og den nyeste blinker kort,
 * så man opdager den ud af øjenkrogen. Seerne ser den ikke: den ligger kun over sælgerens eget billede.
 */
export type ChatSize = "fra" | "normal" | "stor" | "xl";
export const CHAT_SIZES: { key: ChatSize; label: string }[] = [
  { key: "fra", label: "Fra" },
  { key: "normal", label: "Normal" },
  { key: "stor", label: "Stor" },
  { key: "xl", label: "Ekstra stor" },
];
export const CHAT_SIZE_KEY = "relived-studiechat";

/** Så mange beskeder står der ad gangen (færre, jo større skriften er). */
const COUNT: Record<Exclude<ChatSize, "fra">, number> = { normal: 5, stor: 4, xl: 3 };
/** Efter så lang tid bliver en besked mere gennemsigtig, så de nye springer i øjnene. */
const OLD_MS = 45_000;

const NAME_COLORS = ["#FFB3C0", "#9FE6C3", "#F5D38A", "#A9C8FF", "#E6B8FF", "#FFC79E", "#8FE3E8"];
function nameColor(handle: string) {
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

/** Beskeder, sælgeren selv har sat i gang (start, slut, lynrunde, budsalg). Køb og bud vises stadig. */
const OWN_EVENT = /^(Showet er|Lynrunde!|Budsalg!|Ingen bød)/;

export const isQuestion = (body: string) => /\?\s*$/.test(body.trim());

export function readChatSize(fallback: ChatSize): ChatSize {
  try {
    const v = localStorage.getItem(CHAT_SIZE_KEY);
    return CHAT_SIZES.some((s) => s.key === v) ? (v as ChatSize) : fallback;
  } catch {
    return fallback;
  }
}

export default function BigChat({ messages, size }: { messages: Message[]; size: ChatSize }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  if (size === "fra") return null;
  const shown = messages.filter((m) => (m.kind === "event" ? !OWN_EVENT.test(m.body) : !m.from_seller)).slice(-COUNT[size]);
  if (!shown.length) return null;
  const newest = shown[shown.length - 1].id;
  return (
    <div className={`bigchat bigchat-${size}`} aria-hidden="true">
      {shown.map((m) => {
        const old = now - new Date(m.created_at).getTime() > OLD_MS;
        const cls = ["bc", m.kind === "event" ? "bc-event" : "", m.kind !== "event" && isQuestion(m.body) ? "bc-q" : "", old ? "bc-old" : "", m.id === newest ? "bc-new" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <p key={m.id} className={cls}>
            <span>
              {m.kind === "event" ? null : <b style={{ color: nameColor(m.handle) }}>{m.handle}</b>}
              {m.kind !== "event" && isQuestion(m.body) ? <em>?</em> : null}
              {m.body}
            </span>
          </p>
        );
      })}
    </div>
  );
}
