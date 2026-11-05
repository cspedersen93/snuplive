"use client";

import type { Room } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { useSubtitleAgent } from "@/components/LiveSubtitles";
import { errorText, toast } from "@/lib/toast";

const WANT_KEY = "relived-undertekster-studie";

function readWant() {
  try {
    return localStorage.getItem(WANT_KEY) !== "fra";
  } catch {
    return true;
  }
}

/**
 * Studiet: automatiske undertekster (lib/subtitles.ts). Når værten er live med kameraet tændt, bliver programmet sendt
 * ind i showet. Værten kan slå det fra og til, og valget huskes til næste show. Gæsterne ser bare, om det kører.
 * Status kommer fra, om programmet rent faktisk er i showet, ikke fra knappen.
 */
export default function StudioSubtitles({
  room,
  showId,
  live,
  cameraOn,
  isHost,
}: {
  room: Room | null;
  showId: string;
  live: boolean;
  cameraOn: boolean;
  isHost: boolean;
}) {
  const agent = useSubtitleAgent(room);
  const [want, setWant] = useState(true);
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const sent = useRef(false);

  useEffect(() => setWant(readWant()), []);

  async function call(method: "POST" | "DELETE") {
    const r = await fetch(`/api/shows/${showId}/undertekster`, { method });
    const j = (await r.json().catch(() => ({}))) as { error?: string; on?: boolean };
    if (!r.ok) throw new Error(j.error || "Underteksterne svarer ikke.");
    return j.on === true;
  }

  // Slukkes kameraet, sendes programmet ind igen, når det tændes (det går selv ud efter 2 minutter uden kamera).
  useEffect(() => {
    if (!cameraOn || !room) sent.current = false;
  }, [cameraOn, room]);

  // Send programmet ind, når værten er live med kameraet tændt.
  useEffect(() => {
    if (!isHost || !live || !cameraOn || !room || !want || sent.current) return;
    sent.current = true;
    setAsked(Date.now());
    call("POST").catch((e) => console.warn("[relived] undertekster:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, live, cameraOn, room, want]);

  // Uret til "starter …": efter 25 sekunder uden program står der, at det ikke virker lige nu.
  useEffect(() => {
    if (!asked || agent) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [asked, agent]);

  async function toggle() {
    const next = !want;
    setBusy(true);
    try {
      if (next) {
        sent.current = true;
        setAsked(Date.now());
        setNow(Date.now());
        await call("POST");
      } else {
        await call("DELETE");
      }
      setWant(next);
      try {
        localStorage.setItem(WANT_KEY, next ? "til" : "fra");
      } catch {
        // Valget bliver ikke husket. Det gør ikke noget.
      }
      toast(next ? "Underteksterne starter om et øjeblik." : "Underteksterne er slået fra.");
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!live) {
    return (
      <div className="subs-ctrl" data-state="wait">
        <span className="subs-cc" aria-hidden="true">CC</span>
        <span>
          <b>Automatiske undertekster</b>
          <span className="muted">Når du er live, ser seerne det, du siger, som tekst i videoen.</span>
        </span>
      </div>
    );
  }

  const state = agent ? "on" : !want ? "off" : asked && now - asked > 25_000 ? "failed" : "starting";
  const text =
    state === "on"
      ? "Seerne ser det, du siger, som tekst i videoen. Teksten bliver ikke gemt."
      : state === "off"
        ? "Slået fra i det her show."
        : state === "failed"
          ? "Underteksterne virker ikke lige nu. Showet kører helt normalt."
          : "Starter …";
  return (
    <div className="subs-ctrl" data-state={state}>
      <span className="subs-cc" aria-hidden="true">CC</span>
      <span>
        <b>Automatiske undertekster{state === "on" ? ": til" : state === "off" ? ": fra" : ""}</b>
        <span className="muted">{text}</span>
      </span>
      {isHost ? (
        <button className="btn btn-line btn-sm" type="button" onClick={toggle} disabled={busy}>
          {busy ? "Et øjeblik …" : want ? "Slå fra" : "Slå til"}
        </button>
      ) : null}
    </div>
  );
}
