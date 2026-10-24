"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, MediaDeviceFailure, Track, VideoPresets, type LocalVideoTrack } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { CLIP_MIN_MS, CLIP_SECONDS, recordClip } from "@/lib/clipRecorder";
import { frameFromVideo } from "@/lib/resizeImage";
import { IconBlurBg, IconFlip, IconMic, IconSun } from "@/components/Icons";
import type { CameraFilters } from "@/lib/cameraFilters";
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

const isSeller = (identity: string) => identity.startsWith("seller:");

function useViewerCount(onViewers: (n: number) => void) {
  const participants = useParticipants();
  const n = participants.filter((p) => !isSeller(p.identity)).length;
  useEffect(() => onViewers(n), [n, onViewers]);
}

/* ── Seer ──────────────────────────────────────────────────────────────── */

function ViewerStage({ onViewers }: { onViewers: (n: number) => void }) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const cam = tracks.find((t) => isSeller(t.participant.identity));
  const state = useConnectionState();
  useViewerCount(onViewers);
  return (
    <>
      {cam ? (
        <VideoTrack trackRef={cam} className="live-video" playsInline muted />
      ) : (
        <div className="stage-msg">
          {state === ConnectionState.Connected ? "Sælgeren gør kameraet klar …" : "Forbinder til showet …"}
        </div>
      )}
      <StartAudio label="Tryk for lyd" className="btn btn-red btn-sm start-audio" />
    </>
  );
}

export function ViewerVideo(props: {
  token: string;
  url: string;
  onViewers: (n: number) => void;
  onError: (e: Error) => void;
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
      <ViewerStage onViewers={props.onViewers} />
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
  /** Skifter værdien, tages et billede i 4:5 (til tingen, der lige er vist frem). */
  captureKey?: number | null;
  onCapture?: (jpeg: Blob) => void;
  /** Skifter den, optages et klip på op til 15 sekunder af tingen, der lige er vist frem. */
  clip?: { key: number; itemId: string } | null;
  onClip?: (itemId: string, video: Blob, ext: "mp4" | "webm") => void;
}

function StudioStage({ onViewers, onCamera, onSnapshot, snapshotEvery, captureKey, onCapture, clip, onClip }: StageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const cam = tracks.find((t) => t.participant.isLocal && t.publication?.track);
  const state = useConnectionState();
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flipping, setFlipping] = useState(false);
  useViewerCount(onViewers);
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

  // Billede af tingen, et øjeblik efter at sælgeren har vist den frem.
  useEffect(() => {
    if (!ready || !captureKey || !onCapture) return;
    const t = setTimeout(async () => {
      const v = videoRef.current;
      if (!v) return;
      try {
        const blob = await frameFromVideo(v, 1080, 1350, 0.82);
        if (blob) onCapture(blob);
      } catch {
        // Intet billede denne gang
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [ready, captureKey, onCapture]);

  // Klip af tingen: optager fra kameraet og mikrofonen, til 15 sekunder er gået, eller sælgeren viser den næste.
  const clipKey = clip?.key ?? null;
  const clipItem = clip?.itemId ?? null;
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

  return (
    <>
      {cam ? (
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
  captureKey?: number | null;
  onCapture?: (jpeg: Blob) => void;
  clip?: { key: number; itemId: string } | null;
  onClip?: (itemId: string, video: Blob, ext: "mp4" | "webm") => void;
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
        captureKey={props.captureKey}
        onCapture={props.onCapture}
        clip={props.clip}
        onClip={props.onClip}
      />
    </LiveKitRoom>
  );
}
