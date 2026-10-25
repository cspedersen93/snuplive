"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useConnectionState,
  useLocalParticipant,
  isTrackReference,
  useParticipants,
  useTracks,
  type TrackReference,
} from "@livekit/components-react";
import { ConnectionState, MediaDeviceFailure, Track, VideoPresets, type LocalVideoTrack } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { PHOTO_TIMES, takeCandidate, type PhotoCandidate } from "@/lib/bestPhoto";
import { CLIP_MIN_MS, CLIP_SECONDS, recordClip } from "@/lib/clipRecorder";
import { frameFromVideo } from "@/lib/resizeImage";
import { IconBlurBg, IconFlip, IconMic, IconSun } from "@/components/Icons";
import type { CameraFilters } from "@/lib/cameraFilters";
import type { CamLayout } from "@/lib/types";
import { toast } from "@/lib/toast";

type FilterModule = typeof import("@/lib/cameraFilters");
const FILTER_KEY = "relived-kamerafiltre";

function savedFilters(): CameraFilters {
  try {
    const v = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}");
    return { brighten: v.brighten === true, blur: v.blur === true };
  } catch {
    return { brighten: false, blur: false };
  }
}

/**
 * Kamerafiltre i studiet ("Lys op" og "Slør baggrund"). Valget huskes i browseren til næste show.
 * Filtrene ses af seerne og kommer med på billedet og klippet af tingene.
 */
function useCameraFilters(track: LocalVideoTrack | undefined) {
  const [fx, setFx] = useState<FilterModule | null>(null);
  const [filters, setFilters] = useState<CameraFilters>({ brighten: false, blur: false });
  const [blurBusy, setBlurBusy] = useState(false);
  const wanted = useRef(filters);
  wanted.current = filters;
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let alive = true;
    import("@/lib/cameraFilters")
      .then((m) => {
        if (!alive || !m.filtersSupported()) return;
        setFx(m);
        setFilters(savedFilters());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!fx || !track) return;
    // Ét skift ad gangen, og altid til det seneste valg.
    queue.current = queue.current
      .then(async () => {
        const want = wanted.current;
        const current = track.getProcessor();
        if (!want.brighten && !want.blur) {
          if (current) await track.stopProcessor();
          return;
        }
        let t = fx.filterTransformer(current);
        if (!t) {
          if (current) await track.stopProcessor();
          const proc = fx.createFilterProcessor(want);
          await track.setProcessor(proc);
          t = fx.filterTransformer(proc);
        }
        if (!t) return;
        if (want.blur) setBlurBusy(true);
        const ok = await t.setWant(want);
        setBlurBusy(false);
        if (!ok && wanted.current.blur) {
          setFilters((f) => ({ ...f, blur: false }));
          toast("Baggrunden kan ikke sløres på denne enhed.");
        }
      })
      .catch((e) => {
        setBlurBusy(false);
        console.warn("[relived] kamerafilter:", e);
      });
  }, [fx, track, filters]);

  function toggle(key: keyof CameraFilters) {
    const next = { ...filters, [key]: !filters[key] };
    setFilters(next);
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(next));
    } catch {
      // Browseren gemmer ikke valget. Det gør ikke noget.
    }
    toast(
      key === "brighten"
        ? next.brighten
          ? "Lys op er slået til."
          : "Lys op er slået fra."
        : next.blur
          ? "Baggrunden bliver sløret."
          : "Baggrunden er ikke sløret længere.",
    );
  }

  return { supported: !!fx, filters, blurBusy, toggle };
}

// Værten er "seller:<id>", gæsterne i showet er "cohost:<id>" (se /api/livekit-token). Resten er seere.
const isSeller = (identity: string) => identity.startsWith("seller:");
const isCrew = (identity: string) => identity.startsWith("seller:") || identity.startsWith("cohost:");
const crewId = (identity: string) => identity.slice(identity.indexOf(":") + 1);

/**
 * Seerne: alle undtagen værten og gæsterne. I studiet tælles kun de andre (ens egen forbindelse har ikke noget navn,
 * før den er forbundet). På seersiden tælles man selv med, som før.
 */
function useViewerCount(onViewers: (n: number) => void, studio = false) {
  const participants = useParticipants();
  const n = participants.filter((p) => !isCrew(p.identity) && !(studio && p.isLocal)).length;
  useEffect(() => onViewers(n), [n, onViewers]);
}

type CamRef = TrackReference;

/** De andre kameraer i showet, små i hjørnet. Et tryk gør kameraet stort (kun for den, der trykker). */
function PipRow({ cams, onPick, mirrorLocal }: { cams: CamRef[]; onPick?: (id: string) => void; mirrorLocal?: boolean }) {
  if (!cams.length) return null;
  return (
    <div className="pip-row">
      {cams.map((c) => {
        const id = crewId(c.participant.identity);
        const name = c.participant.name || "Gæst";
        const tile = (
          <>
            <VideoTrack
              trackRef={c}
              className="pip-video"
              playsInline
              muted
              style={mirrorLocal && c.participant.isLocal ? { transform: "scaleX(-1)" } : undefined}
            />
            <span className="pip-name">{c.participant.isLocal ? "Dig" : name}</span>
          </>
        );
        return onPick ? (
          <button key={c.participant.identity} type="button" className="pip" onClick={() => onPick(id)} aria-label={`Vis ${name} stort`}>
            {tile}
          </button>
        ) : (
          <div key={c.participant.identity} className="pip">
            {tile}
          </div>
        );
      })}
    </div>
  );
}

/** Værten først, så gæsterne (altid i samme rækkefølge). */
function crewOrder(cams: CamRef[]) {
  return [...cams].sort((a, b) => {
    const ah = isSeller(a.participant.identity) ? 0 : 1;
    const bh = isSeller(b.participant.identity) ? 0 : 1;
    return ah - bh || a.participant.identity.localeCompare(b.participant.identity);
  });
}

/** Side om side: alle kameraer lige store. Den, hvis ting vises nu, får en rød kant. */
function SplitGrid({
  cams,
  active,
  mirrorLocal,
  localRef,
}: {
  cams: CamRef[];
  active?: string | null;
  mirrorLocal?: boolean;
  localRef?: React.Ref<HTMLVideoElement>;
}) {
  return (
    <div className={`split split-${Math.min(cams.length, 3)}`}>
      {cams.map((c) => {
        const on = Boolean(active) && crewId(c.participant.identity) === active;
        return (
          <div key={c.participant.identity} className={`split-tile${on ? " on" : ""}`}>
            <VideoTrack
              ref={c.participant.isLocal ? localRef : undefined}
              trackRef={c}
              className="split-video"
              playsInline
              muted
              style={mirrorLocal && c.participant.isLocal ? { transform: "scaleX(-1)" } : undefined}
            />
            <span className="split-name">
              {c.participant.isLocal ? "Dig" : c.participant.name || "Gæst"}
              {on ? <b>Viser nu</b> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Seer ──────────────────────────────────────────────────────────────── */

/**
 * Det store billede er kameraet hos den, der ejer tingen, der vises nu (værten eller en gæst).
 * Ellers værtens. De andre kameraer står små i hjørnet.
 */
function ViewerStage({
  onViewers,
  spotlight,
  layout,
}: {
  onViewers: (n: number) => void;
  spotlight?: string | null;
  layout?: CamLayout;
}) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const cams = tracks.filter((t): t is TrackReference => isTrackReference(t) && isCrew(t.participant.identity));
  const [picked, setPicked] = useState<string | null>(null);
  // Skifter tingen, følger billedet med igen.
  useEffect(() => setPicked(null), [spotlight]);
  const want = picked ?? spotlight ?? null;
  const cam =
    cams.find((t) => want && crewId(t.participant.identity) === want) ??
    cams.find((t) => isSeller(t.participant.identity)) ??
    cams[0];
  const state = useConnectionState();
  useViewerCount(onViewers);
  if (layout !== "focus" && cams.length >= 2) {
    return (
      <>
        <div className="split-bg" aria-hidden="true" />
        <SplitGrid cams={crewOrder(cams)} active={spotlight} />
        <StartAudio label="Tryk for lyd" className="btn btn-red btn-sm start-audio" />
      </>
    );
  }
  return (
    <>
      {cam ? (
        <VideoTrack trackRef={cam} className="live-video" playsInline muted />
      ) : (
        <div className="stage-msg">
          {state === ConnectionState.Connected ? "Sælgeren gør kameraet klar …" : "Forbinder til showet …"}
        </div>
      )}
      <PipRow cams={cams.filter((c) => c !== cam)} onPick={setPicked} />
      <StartAudio label="Tryk for lyd" className="btn btn-red btn-sm start-audio" />
    </>
  );
}

export function ViewerVideo(props: {
  token: string;
  url: string;
  onViewers: (n: number) => void;
  onError: (e: Error) => void;
  /** Sælgeren, hvis ting vises nu. Hendes kamera bliver stort (eller får en rød kant side om side). */
  spotlight?: string | null;
  /** Med gæster: side om side eller fokus på den, der viser. */
  layout?: CamLayout;
}) {
  return (
    <LiveKitRoom
      className="lk-fill"
      serverUrl={props.url}
      token={props.token}
      connect
      audio={false}
      video={false}
      options={{ adaptiveStream: true, dynacast: true }}
      onError={props.onError}
    >
      <ViewerStage onViewers={props.onViewers} spotlight={props.spotlight} layout={props.layout} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

/* ── Sælger (studiet) ─────────────────────────────────────────────────── */

interface StageProps {
  onViewers: (n: number) => void;
  onCamera: (ready: boolean) => void;
  onSnapshot?: (jpeg: Blob) => void;
  snapshotEvery?: number | null;
  /**
   * Tingen, sælgeren lige har vist frem. Skifter den, optages et klip på op til 15 sekunder,
   * og der tages billeder undervejs, så det bedste kan blive tingens billede.
   */
  shown?: { key: number; itemId: string } | null;
  onClip?: (itemId: string, video: Blob, ext: "mp4" | "webm") => void;
  onPhotos?: (itemId: string, photos: PhotoCandidate[]) => void;
  /** Med gæster: vis kameraerne, som seerne ser dem. */
  layout?: CamLayout;
  /** Sælgeren, hvis ting vises nu. */
  active?: string | null;
}

function StudioStage({ onViewers, onCamera, onSnapshot, snapshotEvery, shown, onClip, onPhotos, layout, active }: StageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const cam = tracks.find((t) => t.participant.isLocal && t.publication?.track);
  // Værten og gæsterne ser hinanden små i hjørnet.
  const others = tracks.filter(
    (t): t is TrackReference => isTrackReference(t) && !t.participant.isLocal && isCrew(t.participant.identity) && t.publication.isSubscribed,
  );
  const state = useConnectionState();
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flipping, setFlipping] = useState(false);
  useViewerCount(onViewers, true);
  const ready = Boolean(cam);
  const fx = useCameraFilters(cam?.publication?.track as LocalVideoTrack | undefined);
  useEffect(() => onCamera(ready), [ready, onCamera]);
  useEffect(() => () => onCamera(false), [onCamera]);

  // Et stillbillede fra kameraet til forsiden og "Live nu", så kortet viser showet, som det ser ud lige nu.
  useEffect(() => {
    if (!ready || !snapshotEvery || !onSnapshot) return;
    let alive = true;
    const take = async () => {
      const v = videoRef.current;
      if (!v || !alive) return;
      try {
        const blob = await frameFromVideo(v, 480, 720);
        if (blob && alive) onSnapshot(blob);
      } catch {
        // Ingen billede denne gang
      }
    };
    const first = setTimeout(take, 4000);
    const timer = setInterval(take, snapshotEvery);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [ready, snapshotEvery, onSnapshot]);

  // Billeder af tingen, mens den vises (samme 15 sekunder som klippet). Når sælgeren viser den næste ting,
  // eller tiden er gået, sendes billederne videre, så det bedste kan blive tingens billede.
  const shownKey = shown?.key ?? null;
  const shownItem = shown?.itemId ?? null;
  const onPhotosRef = useRef(onPhotos);
  onPhotosRef.current = onPhotos;
  useEffect(() => {
    if (!ready || !shownKey || !shownItem || !onPhotosRef.current) return;
    if (Date.now() - shownKey > 10_000) return;
    const shots: { at: number; c: PhotoCandidate }[] = [];
    const inflight: Promise<void>[] = [];
    let stopped = false;
    const take = (at: number) => {
      const v = videoRef.current;
      if (!v || stopped) return;
      inflight.push(
        takeCandidate(v).then((c) => {
          if (c) shots.push({ at, c });
        }),
      );
    };
    const deliver = async () => {
      if (stopped) return;
      stopped = true;
      timers.forEach(clearTimeout);
      await Promise.all(inflight);
      if (shots.length) onPhotosRef.current?.(shownItem, shots.sort((a, b) => a.at - b.at).map((x) => x.c));
    };
    const since = Date.now() - shownKey;
    const timers = PHOTO_TIMES.map((sec, i) =>
      setTimeout(
        () => {
          take(i);
          if (i === PHOTO_TIMES.length - 1) void deliver();
        },
        Math.max(0, sec * 1000 - since),
      ),
    );
    return () => void deliver();
    // Kun når en ny ting bliver vist (eller kameraet bliver klar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, shownKey, shownItem]);

  // Klip af tingen: optager fra kameraet og mikrofonen, til 15 sekunder er gået, eller sælgeren viser den næste.
  const clipKey = shownKey;
  const clipItem = shownItem;
  const onClipRef = useRef(onClip);
  onClipRef.current = onClip;
  useEffect(() => {
    if (!ready || !clipKey || !clipItem || !onClipRef.current) return;
    // Kommer kameraet først igen længe efter (fx efter et udfald), optager vi ikke en tilfældig bid.
    if (Date.now() - clipKey > 10_000) return;
    const video = cam?.publication?.track?.mediaStreamTrack;
    if (!video || video.readyState !== "live") return;
    const mic = localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
    const stream = new MediaStream(mic && mic.readyState === "live" ? [video, mic] : [video]);
    const ctrl = new AbortController();
    recordClip(stream, CLIP_SECONDS, ctrl.signal).then((c) => {
      if (c && c.ms >= CLIP_MIN_MS) onClipRef.current?.(clipItem, c.blob, c.ext);
    });
    return () => ctrl.abort();
    // Kun når en ny ting bliver vist (eller kameraet bliver klar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, clipKey, clipItem]);

  async function flip() {
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track as LocalVideoTrack | undefined;
    if (!track) return;
    const next = facing === "user" ? "environment" : "user";
    setFlipping(true);
    try {
      await track.restartTrack({ facingMode: next, resolution: VideoPresets.h720.resolution });
      setFacing(next);
    } catch {
      // Enheden har kun ét kamera
    } finally {
      setFlipping(false);
    }
  }

  const split = layout !== "focus" && Boolean(cam) && others.length >= 1;
  return (
    <>
      {split && cam && isTrackReference(cam) ? (
        <>
          <div className="split-bg" aria-hidden="true" />
          <SplitGrid cams={crewOrder([cam, ...others])} active={active} mirrorLocal={facing === "user"} localRef={videoRef} />
        </>
      ) : cam ? (
        <VideoTrack
          ref={videoRef}
          trackRef={cam}
          className="live-video"
          playsInline
          muted
          style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
        />
      ) : (
        <div className="stage-msg">{state === ConnectionState.Connected ? "Tænder kameraet …" : "Forbinder …"}</div>
      )}
      {split ? null : <PipRow cams={others} />}
      <div className="cam-ctrl">
        <button
          type="button"
          className={`cam-btn${isMicrophoneEnabled ? "" : " off"}`}
          aria-pressed={!isMicrophoneEnabled}
          aria-label={isMicrophoneEnabled ? "Slå mikrofonen fra" : "Slå mikrofonen til"}
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          <IconMic />
        </button>
        <button type="button" className="cam-btn" aria-label="Skift kamera" onClick={flip} disabled={flipping}>
          <IconFlip />
        </button>
        {fx.supported && cam ? (
          <>
            <button
              type="button"
              className={`cam-btn${fx.filters.brighten ? " on" : ""}`}
              aria-pressed={fx.filters.brighten}
              aria-label="Lys op"
              title="Lys op: lysere billede uden at ændre farverne"
              onClick={() => fx.toggle("brighten")}
            >
              <IconSun />
            </button>
            <button
              type="button"
              className={`cam-btn${fx.filters.blur ? " on" : ""}${fx.blurBusy ? " busy" : ""}`}
              aria-pressed={fx.filters.blur}
              aria-busy={fx.blurBusy}
              aria-label="Slør baggrund"
              title="Slør baggrunden bag dig"
              onClick={() => fx.toggle("blur")}
              disabled={fx.blurBusy}
            >
              <IconBlurBg />
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}

export function deviceErrorText(failure?: MediaDeviceFailure) {
  if (failure === MediaDeviceFailure.PermissionDenied)
    return "Giv Relived adgang til kamera og mikrofon i browseren (ikonet ved adresselinjen), og prøv igen.";
  if (failure === MediaDeviceFailure.NotFound) return "Vi kan ikke finde et kamera eller en mikrofon på enheden.";
  if (failure === MediaDeviceFailure.DeviceInUse) return "Kameraet bruges af et andet program. Luk det, og prøv igen.";
  return "Kameraet kunne ikke starte. Prøv at genindlæse siden.";
}

export function StudioVideo(props: {
  token: string;
  url: string;
  onViewers: (n: number) => void;
  onError: (e: Error) => void;
  onDeviceError: (text: string) => void;
  onCamera: (ready: boolean) => void;
  onSnapshot?: (jpeg: Blob) => void;
  snapshotEvery?: number | null;
  shown?: { key: number; itemId: string } | null;
  onClip?: (itemId: string, video: Blob, ext: "mp4" | "webm") => void;
  onPhotos?: (itemId: string, photos: PhotoCandidate[]) => void;
  layout?: CamLayout;
  active?: string | null;
}) {
  return (
    <LiveKitRoom
      className="lk-fill"
      serverUrl={props.url}
      token={props.token}
      connect
      audio
      video={{ facingMode: "user", resolution: VideoPresets.h720.resolution }}
      options={{ dynacast: true }}
      onError={props.onError}
      onMediaDeviceFailure={(f) => props.onDeviceError(deviceErrorText(f))}
    >
      <StudioStage
        onViewers={props.onViewers}
        onCamera={props.onCamera}
        onSnapshot={props.onSnapshot}
        snapshotEvery={props.snapshotEvery}
        shown={props.shown}
        onClip={props.onClip}
        onPhotos={props.onPhotos}
        layout={props.layout}
        active={props.active}
      />
      {/* Værten og gæsterne kan høre hinanden. */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
