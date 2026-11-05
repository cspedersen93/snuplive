"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MUSIC_LISTEN_KEY, MUSIC_PICK_KEY, MUSIC_VOLUME, PREVIEW_SECONDS, TRACKS, fadeTo, trackByKey } from "@/lib/music";

// Ventemusik under nedtællingen til live (lib/music.ts).
// MusicPick: sælgerens valg i studiet med en smagsprøve. Studiet spiller ikke musikken under nedtællingen.
// WaitMusic: knappen på showets side, så seerne kan høre musikken, mens de venter (browsere kræver et tryk).

const DEFAULT_TRACK = TRACKS[0].key;

/** Sælgerens valg ("" = ingen musik). Huskes til næste gang. */
export function useMusicPick() {
  const [value, setValue] = useState<string>(DEFAULT_TRACK);
  useEffect(() => {
    try {
      const v = localStorage.getItem(MUSIC_PICK_KEY);
      if (v === "" || trackByKey(v)) setValue(v as string);
    } catch {
      // Privat browser: så starter vi med det første nummer.
    }
  }, []);
  const set = useCallback((v: string) => {
    setValue(v);
    try {
      localStorage.setItem(MUSIC_PICK_KEY, v);
    } catch {
      // Valget gælder så kun nu.
    }
  }, []);
  return [value, set] as const;
}

function stopAudio(a: HTMLAudioElement | null, ms = 500) {
  if (!a) return;
  if (a.paused) return;
  void fadeTo(a, 0, ms).then((done) => done && a.pause());
}

export function MusicPick({ value, onChange, disabled }: { value: string; onChange: (key: string) => void; disabled?: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stopAudio(audio.current);
    audio.current = null;
    setPlaying(null);
  }, []);

  // Smagsprøven stopper, når nedtællingen starter (valget forsvinder) eller man går fra siden.
  useEffect(() => stop, [stop]);

  function preview(key: string) {
    stop();
    const t = trackByKey(key);
    if (!t) return;
    // #t= springer frem til det sted i nummeret, smagsprøven starter.
    const a = new Audio(`${t.src}#t=${t.preview}`);
    a.volume = 0;
    audio.current = a;
    setPlaying(key);
    a.play().then(
      () => {
        if (audio.current !== a) return a.pause();
        void fadeTo(a, 0.9, 400);
        timer.current = setTimeout(() => {
          if (audio.current !== a) return;
          stopAudio(a, 1500);
          audio.current = null;
          setPlaying(null);
        }, PREVIEW_SECONDS * 1000 - 1500);
      },
      () => {
        if (audio.current === a) {
          audio.current = null;
          setPlaying(null);
        }
      },
    );
  }

  const t = trackByKey(value);
  return (
    <div className="wm-pick">
      <label htmlFor="wm-sel">Ventemusik</label>
      <div className="wm-row">
        <select
          id="wm-sel"
          className="wm-select"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            // Lytter man allerede, skifter smagsprøven med.
            if (playing) {
              if (v) preview(v);
              else stop();
            }
          }}
        >
          <option value="">Ingen musik</option>
          {TRACKS.map((tr) => (
            <option key={tr.key} value={tr.key}>
              {tr.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={"wm-play" + (playing ? " on" : "")}
          disabled={!t || disabled}
          aria-pressed={Boolean(playing)}
          aria-label={playing ? "Stop smagsprøven" : t ? `Lyt til et udpluk af ${t.title}` : "Lyt"}
          onClick={() => (playing ? stop() : t && preview(t.key))}
        >
          {playing ? <Bars /> : <PlayIcon />}
          <span>{playing ? "Stop" : "Lyt"}</span>
        </button>
      </div>
      <small className="wm-note">
        {t ? `Musik af ${t.artist}. Seerne kan høre den, mens de venter, og den tones ud, når du går live.` : "Seerne venter uden musik."}
      </small>
    </div>
  );
}

export function WaitMusic({ trackKey }: { trackKey: string }) {
  const t = trackByKey(trackKey);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);

  const start = useCallback(
    (remember: boolean) => {
      const a = audio.current;
      if (!a || !t) return;
      // play() skal kaldes direkte i trykket, ellers afviser telefonens browser det.
      a.play().then(
        () => {
          setOn(true);
          void fadeTo(a, MUSIC_VOLUME, 1200);
          if (remember) save("1");
          try {
            if ("mediaSession" in navigator) {
              navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: "Relived · venter på live" });
            }
          } catch {
            // Låseskærmen viser bare ikke titlen.
          }
        },
        () => setOn(false),
      );
    },
    [t],
  );

  useEffect(() => {
    if (!t) return;
    const a = new Audio(t.src);
    a.loop = true;
    a.preload = "none";
    a.volume = 0;
    audio.current = a;
    const paused = () => setOn(false);
    a.addEventListener("pause", paused);
    // Har seeren slået musikken til før, prøver vi selv. Siger browseren nej, står knappen der.
    let again = false;
    try {
      again = localStorage.getItem(MUSIC_LISTEN_KEY) === "1";
    } catch {
      again = false;
    }
    if (again) start(false);
    return () => {
      // Showet går live, eller nedtællingen stoppes: musikken tones ud.
      a.removeEventListener("pause", paused);
      audio.current = null;
      stopAudio(a, 1500);
    };
  }, [t, start]);

  if (!t) return null;

  function stop() {
    stopAudio(audio.current, 600);
    setOn(false);
    save("0");
  }

  return (
    <button
      type="button"
      className={"wm-btn" + (on ? " on" : "")}
      aria-pressed={on}
      aria-label={on ? `Slå ventemusikken fra (${t.title} af ${t.artist})` : "Tryk for ventemusik"}
      onClick={() => (on ? stop() : start(true))}
    >
      {on ? <Bars /> : <SpeakerIcon />}
      {on ? (
        <span>
          {t.title} <span className="wm-by">· {t.artist}</span>
        </span>
      ) : (
        <span>Tryk for ventemusik</span>
      )}
      {on ? <MuteIcon /> : null}
    </button>
  );
}

function save(v: string) {
  try {
    localStorage.setItem(MUSIC_LISTEN_KEY, v);
  } catch {
    // Valget gælder så kun nu.
  }
}

function Bars() {
  return (
    <span className="wm-bars" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg className="wm-x" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
