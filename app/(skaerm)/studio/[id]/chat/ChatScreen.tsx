"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Chat from "@/components/Chat";
import { useShowRealtime } from "@/components/useShowRealtime";
import { useWakeLock } from "@/components/useWakeLock";
import { isAuction } from "@/lib/auction";
import { countingDown, mmss } from "@/lib/countdown";
import { kr } from "@/lib/format";
import type { Item, Message, Show } from "@/lib/types";

const SCALES = [1, 1.35, 1.75, 2.2, 2.8];
const SCALE_KEY = "relived-chatskaerm";

function elapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Status på den vare, der bliver vist lige nu. */
function itemStatus(i: Item, now: number) {
  if (i.status === "sold") return i.high_handle ? `Solgt til @${i.high_handle}` : "Solgt";
  if (isAuction(i) && i.auction_ends_at && new Date(i.auction_ends_at).getTime() > now) {
    return i.high_bid ? `Budsalg · højeste bud ${kr(i.high_bid)}${i.high_handle ? ` (@${i.high_handle})` : ""}` : "Budsalg · ingen bud endnu";
  }
  return isAuction(i) ? `Startpris ${kr(i.price)}` : kr(i.price);
}

/**
 * Chatten på en anden skærm med stor skrift. Viser showet, tiden, varen, der bliver vist, og chatten, som kan læses
 * på afstand og svares fra. Skærmen slukker ikke af sig selv, mens siden er åben.
 */
export default function ChatScreen(props: {
  show: Show;
  items: Item[];
  messages: Message[];
  me: { id: string; handle: string };
  canModerate: boolean;
  serverNow: number;
}) {
  const { show, items, messages } = useShowRealtime({ show: props.show, items: props.items, messages: props.messages });
  const [scale, setScale] = useState(2);
  const [offset] = useState(() => props.serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  useWakeLock(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCALE_KEY);
      const v = raw === null ? NaN : Number(raw);
      if (Number.isInteger(v) && v >= 0 && v < SCALES.length) setScale(v);
    } catch {
      // Så bruges standardstørrelsen.
    }
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);

  function zoom(d: number) {
    const next = Math.max(0, Math.min(SCALES.length - 1, scale + d));
    setScale(next);
    try {
      localStorage.setItem(SCALE_KEY, String(next));
    } catch {
      // Valget bliver ikke husket. Det gør ikke noget.
    }
  }

  const live = show.status === "live";
  const counting = countingDown(show, now);
  const countLeft = counting && show.countdown_to ? Date.parse(show.countdown_to) - now : null;
  const current = items.find((i) => i.id === show.current_item_id) ?? null;
  return (
    <div className="cscreen" style={{ ["--cs" as string]: SCALES[scale] }}>
      <header className="cscreen-top">
        <div className="cscreen-show">
          {live ? (
            <span className="chip live">
              <span className="live-dot white" />
              Live
            </span>
          ) : countLeft !== null ? (
            <span className="chip live">Live om {mmss(countLeft)}</span>
          ) : (
            <span className="chip">{show.status === "ended" ? "Slut" : "Ikke live"}</span>
          )}
          {live && show.started_at ? <span className="timer">{elapsed(now - new Date(show.started_at).getTime())}</span> : null}
          <b className="cscreen-title">{show.title}</b>
        </div>
        <div className="cscreen-now" aria-live="polite">
          {current ? (
            <>
              <span className="cscreen-k">Vises nu</span>
              <b>{current.name}</b>
              <span>{itemStatus(current, now)}</span>
            </>
          ) : (
            <span className="muted">Ingen vare bliver vist lige nu</span>
          )}
        </div>
        <div className="cscreen-tools">
          <button className="icon-btn" type="button" onClick={() => zoom(-1)} disabled={scale === 0} aria-label="Mindre skrift">
            A−
          </button>
          <button className="icon-btn" type="button" onClick={() => zoom(1)} disabled={scale === SCALES.length - 1} aria-label="Større skrift">
            A+
          </button>
          <Link className="btn btn-line btn-sm" href={`/studio/${show.id}`}>
            Til studiet
          </Link>
        </div>
      </header>
      <Chat
        showId={show.id}
        messages={messages}
        me={props.me}
        live={live || counting}
        loginHref={`/login?next=/studio/${show.id}/chat`}
        canModerate={props.canModerate}
      />
    </div>
  );
}
