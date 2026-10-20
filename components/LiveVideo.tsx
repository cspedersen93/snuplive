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
import { frameFromVideo } from "@/lib/resizeImage";
import { IconFlip, IconMic } from "@/components/Icons";

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
}

function StudioStage({ onViewers, onCamera, onSnapshot, snapshotEvery, captureKey, onCapture }: StageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const cam = tracks.find((t) => t.participant.isLocal && t.publication?.track);
  const state = useConnectionState();
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flipping, setFlipping] = useState(false);
  useViewerCount(onViewers);
  const ready = Boolean(cam);
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
      </div>
    </>
  );
}

export function deviceErrorText(failure?: MediaDeviceFailure) {
  if (failure === MediaDeviceFailure.PermissionDenied)
    return "Giv SnupLive adgang til kamera og mikrofon i browseren (ikonet ved adresselinjen), og prøv igen.";
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
      />
    </LiveKitRoom>
  );
}
