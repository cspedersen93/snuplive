"use client";

import { RoomEvent, type Participant, type RemoteParticipant, type Room } from "livekit-client";
import { useEffect, useRef, useState } from "react";

/**
 * Automatiske undertekster i videoen (agent/main.py og lib/subtitles.ts). Programmet hos LiveKit sender teksten som
 * små beskeder med emnet "undertekst". Kun beskeder fra programmet selv bliver vist: seerne kan også sende beskeder
 * (reaktioner), men aldrig som programmet.
 */
const TOPIC = "undertekst";
const PREF_KEY = "relived-undertekster";
/** Så længe står en færdig sætning, før den forsvinder (millisekunder). */
const HOLD_MS = 4500;
/** Foreløbig tekst, der ikke bliver opdateret, forsvinder efter så lang tid. */
const STALE_MS = 3000;
const MAX_CHARS = 96;

type Line = { who: string; name: string; seg: number; text: string; final: boolean; at: number };

const isAgent = (p: Participant | undefined) => Boolean(p && (p.isAgent || p.identity.startsWith("agent-")));

/** Programmet med underteksterne, hvis det er i showet. */
export function useSubtitleAgent(room: Room | null) {
  const [agent, setAgent] = useState<string | null>(null);
  useEffect(() => {
    if (!room) {
      setAgent(null);
      return;
    }
    const find = () => [...room.remoteParticipants.values()].find((p) => isAgent(p))?.identity ?? null;
    const update = () => setAgent(find());
    update();
    room.on(RoomEvent.ParticipantConnected, update);
    room.on(RoomEvent.ParticipantDisconnected, update);
    room.on(RoomEvent.Connected, update);
    room.on(RoomEvent.Reconnected, update);
    return () => {
      room.off(RoomEvent.ParticipantConnected, update);
      room.off(RoomEvent.ParticipantDisconnected, update);
      room.off(RoomEvent.Connected, update);
      room.off(RoomEvent.Reconnected, update);
    };
  }, [room]);
  return agent;
}

/** De sidste ord, hvis teksten er for lang til to linjer. */
function tail(text: string) {
  if (text.length <= MAX_CHARS) return text;
  const cut = text.slice(-MAX_CHARS);
  const space = cut.indexOf(" ");
  return `… ${space > 0 && space < 24 ? cut.slice(space + 1) : cut}`;
}

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) !== "fra";
  } catch {
    return true;
  }
}

export default function LiveSubtitles({ room, mode, multi = false }: { room: Room | null; mode: "viewer" | "studio"; multi?: boolean }) {
  const agent = useSubtitleAgent(room);
  const [on, setOn] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const agentRef = useRef<string | null>(null);
  agentRef.current = agent;

  useEffect(() => {
    if (mode === "viewer") setOn(readPref());
  }, [mode]);

  useEffect(() => {
    if (!room) return;
    const decoder = new TextDecoder();
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC || !participant || !isAgent(participant)) return;
      // Er der (kortvarigt) to programmer i showet, vises kun teksten fra det første.
      if (agentRef.current && participant.identity !== agentRef.current) return;
      let m: { v?: unknown; who?: unknown; name?: unknown; seg?: unknown; final?: unknown; text?: unknown };
      try {
        m = JSON.parse(decoder.decode(payload));
      } catch {
        return;
      }
      if (m.v !== 1 || typeof m.who !== "string" || typeof m.text !== "string" || typeof m.seg !== "number") return;
      const line: Line = {
        who: m.who.slice(0, 80),
        name: typeof m.name === "string" ? m.name.slice(0, 40) : "",
        seg: m.seg,
        text: m.text.replace(/\s+/g, " ").trim().slice(0, 300),
        final: m.final === true,
        at: Date.now(),
      };
      if (!line.text) return;
      setLines((prev) => {
        const old = prev.find((l) => l.who === line.who);
        // En foreløbig tekst må ikke overskrive den færdige sætning, den hører til.
        if (old && old.seg === line.seg && old.final && !line.final) return prev;
        if (old && line.seg < old.seg) return prev;
        return [...prev.filter((l) => l.who !== line.who), line].slice(-3);
      });
      setNow(Date.now());
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  // Gammel tekst forsvinder af sig selv. Uret kører kun, mens der er tekst.
  const visible = lines.filter((l) => now - l.at < (l.final ? HOLD_MS : STALE_MS));
  useEffect(() => {
    if (!lines.length) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [lines.length]);
  useEffect(() => {
    if (lines.length && !visible.length) setLines([]);
  }, [lines.length, visible.length]);
  // Programmet er gået: ingen gammel tekst.
  useEffect(() => {
    if (!agent) setLines([]);
  }, [agent]);

  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(PREF_KEY, next ? "til" : "fra");
    } catch {
      // Valget bliver ikke husket. Det gør ikke noget.
    }
  }

  if (!agent) return null;
  const shown = visible.slice(-2);
  const names = multi || new Set(shown.map((l) => l.who)).size > 1;
  return (
    <>
      {mode === "viewer" ? (
        <button
          className={`v-cc${on ? " on" : ""}`}
          type="button"
          onClick={toggle}
          aria-pressed={on}
          title={on ? "Slå de automatiske undertekster fra" : "Slå automatiske undertekster til"}
        >
          <span aria-hidden="true">CC</span>
          <span className="sr-only">Automatiske undertekster</span>
        </button>
      ) : null}
      {on && shown.length ? (
        <div className={`v-sub v-sub-${mode}`} aria-hidden="true">
          {shown.map((l) => (
            <p key={l.who}>
              <span>
                {names && l.name ? <b>{l.name}: </b> : null}
                {tail(l.text)}
              </span>
            </p>
          ))}
          <small>Automatiske undertekster</small>
        </div>
      ) : null}
    </>
  );
}
