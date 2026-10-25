"use client";

import { ConnectionState, RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconHeart } from "@/components/Icons";
import {
  BIG,
  BIG_COOLDOWN_MS,
  BIG_QUEUE,
  BIG_SHOW_MS,
  Bucket,
  Echo,
  FLUSH_EVERY_MS,
  HostRelay,
  SEND_EVERY_MS,
  SMALL,
  TOPIC,
  bigInfo,
  decodeToAll,
  decodeToHost,
  encode,
  smallInfo,
  type BigEvent,
  type BigKind,
  type Counts,
  type SmallKind,
} from "@/lib/reactions";
import { toast } from "@/lib/toast";

/**
 * Reaktioner i et live-show (se lib/reactions.ts for, hvordan de sendes).
 * - "viewer": seeren. Knapper til hjerter, emojis og store effekter, og dobbelttryk på videoen sender et hjerte.
 * - "host": værten i studiet. Tager imod seernes tryk, viser dem og sender en opsamling til alle.
 * - "guest": en gæst i studiet. Ser bare med.
 */
type Role = "viewer" | "host" | "guest";

const COLORS = ["#EB0029", "#FF5A70", "#FF8A9B", "#F2C46B", "#B9D9C6", "#FFFFFF"];
const MAX_PARTICLES = 32;

interface Particle {
  id: number;
  k: SmallKind;
  x0: number;
  x1: number;
  rot: number;
  dur: number;
  delay: number;
  size: number;
  color: string;
}
interface Pop {
  id: number;
  x: number;
  y: number;
}
interface Fx extends BigEvent {
  key: number;
  mine?: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const sum = (c: Counts) => Object.values(c).reduce((a, n) => a + (n ?? 0), 0);
let seq = 0;

function IconSmile() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M20.5 11.5a8.5 8.5 0 1 1-6.2-8.2" />
      <path d="M8.6 14.4c.9 1.2 2.1 1.8 3.4 1.8s2.5-.6 3.4-1.8" />
      <path d="M9 9.6v.6M15 9.6v.6" strokeWidth={2.4} />
      <path d="M19 2.5v5M16.5 5h5" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1.5c.6 5.6 2.4 8.6 10.5 10.5-8.1 1.9-9.9 4.9-10.5 10.5-.6-5.6-2.4-8.6-10.5-10.5C9.6 10.1 11.4 7.1 12 1.5Z" />
    </svg>
  );
}

/** Den store effekt. Tilfældige stykker, lavet én gang, når effekten starter. */
function BigFx({ k }: { k: BigKind }) {
  const [pieces] = useState(() => {
    if (k === "konfetti")
      return Array.from({ length: 72 }, () => ({
        x: rand(0, 100),
        d: rand(0, 0.9),
        t: rand(2.3, 3.2),
        dx: rand(1.5, 6),
        r: pick([-1, 1]) * rand(240, 720),
        w: rand(1.6, 2.8),
        c: pick(COLORS),
        round: Math.random() < 0.25,
      }));
    if (k === "hjerteregn")
      return Array.from({ length: 34 }, () => ({
        x: rand(3, 97),
        d: rand(0, 1.1),
        t: rand(2.1, 3),
        dx: rand(1, 4),
        r: 0,
        w: rand(4.5, 9.5),
        c: pick(COLORS),
        round: false,
      }));
    // Stjerneskud: gnister langs sporet, i takt med at stjernen kommer forbi.
    return Array.from({ length: 22 }, (_, i) => {
      const p = (i + rand(0, 0.6)) / 22;
      return { x: p * 100, d: 0.15 + p * 1.5, t: 1.4, dx: rand(-6, 6), r: 0, w: rand(1.8, 4), c: pick(["#FFFFFF", "#F2C46B", "#FF8A9B"]), round: false };
    });
  });

  if (k === "konfetti")
    return (
      <div className="rx-fx rx-conf" aria-hidden="true">
        {pieces.map((p, i) => (
          <i key={i} style={{ left: `${p.x}%`, ["--t" as string]: `${p.t}s`, ["--d" as string]: `${p.d}s` }}>
            <b
              className={p.round ? "round" : undefined}
              style={{ ["--w" as string]: `${p.w}cqw`, ["--c" as string]: p.c, ["--dx" as string]: `${p.dx}cqw`, ["--r" as string]: `${p.r}deg` }}
            />
          </i>
        ))}
      </div>
    );
  if (k === "hjerteregn")
    return (
      <div className="rx-fx rx-rain" aria-hidden="true">
        {pieces.map((p, i) => (
          <i key={i} style={{ left: `${p.x}%`, ["--t" as string]: `${p.t}s`, ["--d" as string]: `${p.d}s` }}>
            <b style={{ ["--s" as string]: `${p.w}cqw`, ["--c" as string]: p.c, ["--dx" as string]: `${p.dx}cqw` }}>
              <IconHeart fill="currentColor" />
            </b>
          </i>
        ))}
      </div>
    );
  return (
    <div className="rx-fx" aria-hidden="true">
      <div className="rx-shoot">
        <span className="rx-star">
          <IconStar />
        </span>
        {pieces.map((p, i) => (
          <span
            key={i}
            className="rx-spark"
            style={{ left: `${p.x}%`, top: `${p.dx}cqw`, ["--s" as string]: `${p.w}cqw`, ["--c" as string]: p.c, ["--d" as string]: `${p.d}s` }}
          >
            <IconStar />
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Reactions({
  room,
  role,
  hostIdentity,
  loggedIn = false,
  loginHref = "/login",
}: {
  room: Room | null;
  role: Role;
  /** Værtens forbindelse i videoen: "seller:<id>". */
  hostIdentity: string;
  /** Store effekter kræver, at seeren er logget ind (navnet vises). */
  loggedIn?: boolean;
  loginHref?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const [parts, setParts] = useState<Particle[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [fx, setFx] = useState<Fx | null>(null);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const [coolUntil, setCoolUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const active = useRef(0);
  const queue = useRef<Fx[]>([]);
  const playing = useRef(false);
  const pending = useRef<Counts>({});
  const bucket = useRef<Bucket | null>(null);
  const echo = useRef(new Echo());
  const relay = useRef<HostRelay | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  // Forbundet til videoen?
  useEffect(() => {
    if (!room) {
      setConnected(false);
      return;
    }
    const on = () => setConnected(room.state === ConnectionState.Connected);
    on();
    room.on(RoomEvent.ConnectionStateChanged, on);
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, on);
    };
  }, [room]);

  /** Små reaktioner op langs højre side. Spredt ud over `spread` ms, så en opsamling ikke kommer som én klump. */
  const spawn = useCallback((c: Counts, spread = 0) => {
    const add: Particle[] = [];
    for (const [k, v] of Object.entries(c) as [SmallKind, number][]) {
      for (let i = 0; i < v; i++) {
        if (active.current + add.length >= MAX_PARTICLES) break;
        const heart = k === "heart";
        add.push({
          id: ++seq,
          k,
          x0: rand(-2.5, 2.5),
          x1: rand(-7, 4),
          rot: heart ? rand(-18, 18) : rand(-10, 10),
          dur: rand(2.2, 3),
          delay: spread ? rand(0, spread / 1000) : 0,
          size: heart ? rand(6, 8.5) : rand(6.5, 8),
          color: pick(COLORS),
        });
      }
    }
    if (!add.length) return;
    active.current += add.length;
    setParts((ps) => [...ps, ...add]);
    const longest = Math.max(...add.map((p) => p.dur + p.delay));
    const ids = new Set(add.map((p) => p.id));
    setTimeout(() => {
      active.current -= add.length;
      setParts((ps) => ps.filter((p) => !ids.has(p.id)));
    }, longest * 1000 + 200);
  }, []);

  /** Store effekter: én ad gangen, højst tre i kø. */
  const playNext = useCallback(() => {
    const nxt = queue.current.shift();
    if (!nxt) {
      playing.current = false;
      setFx(null);
      return;
    }
    playing.current = true;
    setFx(nxt);
    setTimeout(() => playNext(), BIG_SHOW_MS);
  }, []);
  const play = useCallback(
    (ev: BigEvent, mine = false) => {
      if (queue.current.length >= BIG_QUEUE) return;
      queue.current.push({ ...ev, mine, key: ++seq });
      if (!playing.current) playNext();
    },
    [playNext],
  );

  // Seeren: tryk samles og sendes til værten hver 0,4 sekund.
  useEffect(() => {
    if (role !== "viewer" || !room || !connected) return;
    const t = setInterval(() => {
      const c = pending.current;
      if (!sum(c)) return;
      pending.current = {};
      // Er værten ikke forbundet lige nu, sender vi ikke (man ser stadig sine egne).
      if (!room.getParticipantByIdentity(hostIdentity)) return;
      echo.current.sent(c);
      void room.localParticipant
        .publishData(encode({ v: 1, t: "r", c }), { reliable: false, destinationIdentities: [hostIdentity], topic: TOPIC })
        .catch(() => {});
    }, SEND_EVERY_MS);
    return () => clearInterval(t);
  }, [role, room, connected, hostIdentity]);

  // Værten: sender opsamlingen til alle hvert halve sekund.
  useEffect(() => {
    if (role !== "host" || !room || !connected) return;
    relay.current ??= new HostRelay();
    const t = setInterval(() => {
      const { small, big } = relay.current!.flush();
      if (small)
        void room.localParticipant.publishData(encode({ v: 1, t: "R", c: small }), { reliable: false, topic: TOPIC }).catch(() => {});
      if (big) {
        void room.localParticipant.publishData(encode({ v: 1, t: "B", ...big }), { reliable: true, topic: TOPIC }).catch(() => {});
        play(big);
      }
    }, FLUSH_EVERY_MS);
    return () => clearInterval(t);
  }, [role, room, connected, play]);

  // Det, der kommer ind.
  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC || !participant) return;
      if (role === "host") {
        const msg = decodeToHost(payload);
        if (!msg) return;
        const shown = relay.current?.fromViewer(participant.identity, participant.name ?? "", msg);
        if (shown) spawn(shown, 300);
        return;
      }
      // Seere og gæster lytter kun til værten.
      if (participant.identity !== hostIdentity) return;
      const msg = decodeToAll(payload);
      if (!msg) return;
      if (msg.t === "R") {
        const c = role === "viewer" ? echo.current.others(msg.c) : msg.c;
        if (sum(c)) spawn(c, FLUSH_EVERY_MS);
      } else if (msg.id !== room.localParticipant.identity) {
        play({ k: msg.k, who: msg.who, id: msg.id });
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, role, hostIdentity, spawn, play]);

  const tap = useCallback(
    (k: SmallKind) => {
      bucket.current ??= new Bucket();
      if (!bucket.current.take(1)) return;
      spawn({ [k]: 1 });
      pending.current[k] = (pending.current[k] ?? 0) + 1;
      if (k === "heart") setBump((n) => n + 1);
    },
    [spawn],
  );

  function sendBig(k: BigKind) {
    if (!room) return;
    if (!loggedIn) {
      toast("Log ind for at sende store effekter. Så kan alle se, hvem de er fra.", loginHref, "Log ind");
      return;
    }
    if (Date.now() < coolUntil) return;
    setCoolUntil(Date.now() + BIG_COOLDOWN_MS);
    setNow(Date.now());
    setOpen(false);
    play({ k, who: "", id: room.localParticipant.identity }, true);
    if (room.getParticipantByIdentity(hostIdentity))
      void room.localParticipant
        .publishData(encode({ v: 1, t: "b", k }), { reliable: true, destinationIdentities: [hostIdentity], topic: TOPIC })
        .catch(() => {});
  }

  // Nedtælling, til man kan sende en ny stor effekt.
  const cooling = coolUntil > now;
  useEffect(() => {
    if (!cooling) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooling]);
  const coolLeft = Math.max(0, Math.ceil((coolUntil - now) / 1000));

  // Dobbelttryk på videoen sender et hjerte (ikke på knapper, kortet med tingen eller de små kameraer).
  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => {
    if (role !== "viewer" || !connected) return;
    const screen = rootRef.current?.parentElement;
    if (!screen) return;
    let last = { t: 0, x: 0, y: 0 };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element | null;
      if (target?.closest("button,a,input,textarea,select,label,.v-card,.v-top,.pip-row,.rx-panel,.rx-rail,.start-audio,.pre-live")) {
        last.t = 0;
        return;
      }
      const t = performance.now();
      if (t - last.t < 350 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40) {
        last.t = 0;
        const r = screen.getBoundingClientRect();
        const pop = { id: ++seq, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
        setPops((ps) => [...ps.slice(-3), pop]);
        setTimeout(() => setPops((ps) => ps.filter((p) => p.id !== pop.id)), 950);
        tapRef.current("heart");
      } else last = { t, x: e.clientX, y: e.clientY };
    };
    screen.addEventListener("pointerup", onUp);
    return () => screen.removeEventListener("pointerup", onUp);
  }, [role, connected]);

  // Panelet lukker ved tryk udenfor eller Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || moreRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        moreRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const info = fx ? bigInfo(fx.k) : null;
  return (
    <div className={`rx rx-${role}`} ref={rootRef}>
      <div className="rx-stream" aria-hidden="true">
        {parts.map((p) => (
          <span
            key={p.id}
            className="rx-p"
            style={{ ["--dur" as string]: `${p.dur}s`, ["--delay" as string]: `${p.delay}s` }}
          >
            <span
              className="rx-p-in"
              style={{
                ["--s" as string]: `${p.size}cqw`,
                ["--x0" as string]: `${p.x0}cqw`,
                ["--x1" as string]: `${p.x1}cqw`,
                ["--rot" as string]: `${p.rot}deg`,
                color: p.color,
              }}
            >
              {p.k === "heart" ? <IconHeart fill="currentColor" /> : <span className="rx-emoji">{smallInfo(p.k).emoji}</span>}
            </span>
          </span>
        ))}
      </div>
      {pops.map((p) => (
        <span key={p.id} className="rx-pop" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden="true">
          <IconHeart />
        </span>
      ))}
      {fx && info ? (
        <>
          <BigFx key={fx.key} k={fx.k} />
          <div key={`b${fx.key}`} className="rx-banner" aria-hidden="true">
            <span>{info.emoji}</span>
            <em>{fx.mine ? `Du ${info.verb}` : <><b>@{fx.who}</b> {info.verb}</>}</em>
          </div>
        </>
      ) : null}

      {role === "viewer" && connected ? (
        <>
          <div className="rx-rail">
            <button className="rx-btn rx-heart" type="button" onClick={() => tap("heart")} aria-label="Send et hjerte">
              <IconHeart key={bump} className={bump ? "bump" : undefined} />
            </button>
            <button
              ref={moreRef}
              className="rx-btn rx-more"
              type="button"
              aria-expanded={open}
              aria-controls="rx-panel"
              aria-label="Flere reaktioner og effekter"
              onClick={() => setOpen((o) => !o)}
            >
              <IconSmile />
            </button>
          </div>
          {open ? (
            <div className="rx-panel" id="rx-panel" ref={panelRef} role="group" aria-label="Reaktioner og effekter">
              <div className="rx-row">
                {SMALL.map((s) => (
                  <button key={s.k} className="rx-emo" type="button" onClick={() => tap(s.k)} aria-label={s.label} title={s.label}>
                    {s.emoji}
                  </button>
                ))}
              </div>
              <div className="rx-head">Store effekter</div>
              <div className="rx-bigrow">
                {BIG.map((b) => (
                  <button key={b.k} className="rx-big" type="button" onClick={() => sendBig(b.k)} disabled={loggedIn && cooling}>
                    <span aria-hidden="true">{b.emoji}</span>
                    {b.label}
                  </button>
                ))}
              </div>
              {!loggedIn ? (
                <p className="rx-note">Log ind for at sende store effekter.</p>
              ) : cooling ? (
                <p className="rx-note" aria-live="polite">Du kan sende en ny om {coolLeft} sek.</p>
              ) : (
                <p className="rx-note">Dit navn bliver vist. Du kan sende én hvert 30. sekund.</p>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
