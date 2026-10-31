"use client";

import { takeCandidate, type PhotoCandidate } from "@/lib/bestPhoto";
import { clipMimeType, recordClip, type Clip } from "@/lib/clipRecorder";

// Videoannoncer: sælgeren filmer tingen med telefonens bagkamera (eller vælger en video, der allerede er filmet).
// Videoen gemmes i samme format som klippene fra live-showene, så den kan ses på alle telefoner.
// Mens der filmes, tages der billeder, så annoncen får billeder uden at sælgeren skal tage dem selv.

export const VIDEO_MAX_S = 45;
export const VIDEO_MIN_S = 5;
/** Højst så stor må videoen være (samme grænse som mappen "clips" i Supabase). */
export const VIDEO_MAX_BYTES = 15 * 1024 * 1024;
/** Antal billeder, sælgeren (og Claude) kan vælge imellem. */
export const FRAME_CHOICES = 8;
/** Højst så mange billeder på annoncen. */
export const MAX_PHOTOS = 4;

const SAMPLE_FIRST_MS = 800;
const SAMPLE_EVERY_MS = 2000;

export type Frame = PhotoCandidate & { url: string };

/** Telefonens bagkamera (på en computer: det kamera, der er). Med mikrofon, hvis sælgeren siger ja til den. */
export async function openBackCamera(): Promise<MediaStream> {
  const video: MediaTrackConstraints = {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  };
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    // Uden mikrofon går det også (fx hvis den er optaget eller slået fra).
    if (e instanceof DOMException && (e.name === "NotFoundError" || e.name === "NotReadableError" || e.name === "OverconstrainedError")) {
      return navigator.mediaDevices.getUserMedia({ video });
    }
    throw e;
  }
}

export function canRecord() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(clipMimeType());
}

/** Tager et billede med jævne mellemrum fra en video, der spiller (kameraet eller den valgte video). */
export function sampleFrames(video: HTMLVideoElement, out: Frame[], signal: AbortSignal) {
  let busy = false;
  const take = async () => {
    if (busy || signal.aborted) return;
    busy = true;
    const c = await takeCandidate(video);
    busy = false;
    if (c && !signal.aborted) out.push({ ...c, url: URL.createObjectURL(c.full) });
  };
  const first = setTimeout(take, SAMPLE_FIRST_MS);
  const every = setInterval(take, SAMPLE_EVERY_MS);
  signal.addEventListener(
    "abort",
    () => {
      clearTimeout(first);
      clearInterval(every);
    },
    { once: true },
  );
}

/** Op til `n` billeder spredt over hele videoen: det skarpeste fra hver del. Resten frigives. */
export function spreadFrames(all: Frame[], n = FRAME_CHOICES): Frame[] {
  if (all.length <= n) return all;
  const keep: Frame[] = [];
  for (let k = 0; k < n; k++) {
    const part = all.slice(Math.floor((k * all.length) / n), Math.floor(((k + 1) * all.length) / n));
    keep.push(part.reduce((a, b) => (b.sharp > a.sharp ? b : a)));
  }
  all.filter((f) => !keep.includes(f)).forEach((f) => URL.revokeObjectURL(f.url));
  return keep;
}

/** Telefonens eget valg, når Claude ikke svarer: de skarpeste billeder (det skarpeste først). */
export function localPicks(frames: Frame[], n = MAX_PHOTOS): number[] {
  return frames
    .map((f, i) => ({ i, s: f.sharp }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.i);
}

/** Optag fra kameraet, indtil `signal` afbrydes eller tiden er gået. Tager billeder undervejs. */
export async function recordFromCamera(stream: MediaStream, preview: HTMLVideoElement, signal: AbortSignal) {
  const frames: Frame[] = [];
  const sampling = new AbortController();
  sampleFrames(preview, frames, sampling.signal);
  const clip = await recordClip(stream, VIDEO_MAX_S, signal);
  sampling.abort();
  return { clip, frames };
}

export interface PreparedVideo {
  video: HTMLVideoElement;
  url: string;
  /** Så meget af videoen, der bliver brugt (højst 45 sekunder). */
  seconds: number;
  /** Kender vi videoens længde? */
  known: boolean;
}

/** Indlæs en video, sælgeren har valgt, så den kan ses og bagefter gøres klar. */
export function prepareVideo(file: File): Promise<PreparedVideo> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("video/") && !/\.(mov|mp4|m4v|webm|3gp)$/i.test(file.name)) {
      return reject(new Error("Vælg en video."));
    }
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.playsInline = true;
    v.preload = "auto";
    v.muted = false;
    v.setAttribute("playsinline", "");
    // Videoen skal ligge på siden for at blive tegnet i alle browsere, men den skal ikke ses.
    Object.assign(v.style, { position: "fixed", left: "-10px", top: "-10px", width: "2px", height: "2px", opacity: "0", pointerEvents: "none" });
    document.body.appendChild(v);
    const fail = () => {
      clearTimeout(t);
      v.remove();
      URL.revokeObjectURL(url);
      reject(new Error("Videoen kan ikke afspilles i din browser. Film varen direkte her på siden i stedet."));
    };
    const t = setTimeout(fail, 20000);
    v.onerror = fail;
    v.onloadeddata = () => {
      clearTimeout(t);
      // Nogle videoer (fx optaget i en browser) kender ikke deres længde. Så bruges højst 45 sekunder, til videoen slutter.
      const known = Number.isFinite(v.duration) && v.duration > 0;
      if (!v.videoWidth || (known && v.duration < 2)) return fail();
      resolve({ video: v, url, seconds: known ? Math.min(v.duration, VIDEO_MAX_S) : VIDEO_MAX_S, known });
    };
    v.src = url;
    v.load();
  });
}

export function releasePrepared(p: PreparedVideo | null) {
  if (!p) return;
  p.video.pause();
  p.video.remove();
  URL.revokeObjectURL(p.url);
}

/**
 * Gør en valgt video klar: afspiller den (uden lyd for sælgeren) og optager den igen i samme format som klippene,
 * højst 45 sekunder og højst 1280 pixel. Tager billeder undervejs. Skal startes af et tryk (play() og lyd kræver det).
 */
export function convertVideo(p: PreparedVideo, onProgress: (share: number) => void, signal: AbortSignal) {
  const v = p.video;
  const frames: Frame[] = [];
  // Lyden sendes ind i optagelsen i stedet for ud af højttaleren. Går det ikke, optages videoen uden lyd.
  let ac: AudioContext | null = null;
  let audio: MediaStreamTrack[] = [];
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ac = new AC();
      const src = ac.createMediaElementSource(v);
      const dest = ac.createMediaStreamDestination();
      src.connect(dest);
      audio = dest.stream.getAudioTracks();
      void ac.resume();
    }
  } catch {
    audio = [];
  }
  v.muted = audio.length === 0;
  v.currentTime = 0;
  // play() skal kaldes med det samme, mens trykket stadig gælder.
  const playing = v.play();

  return (async (): Promise<{ clip: Clip | null; frames: Frame[] }> => {
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((v.videoWidth * scale) / 2) * 2;
    canvas.height = Math.round((v.videoHeight * scale) / 2) * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.captureStream !== "function") throw new Error("Din browser kan ikke gøre videoen klar. Film varen direkte her på siden i stedet.");
    const stream = canvas.captureStream(30);
    audio.forEach((t) => stream.addTrack(t));
    const stop = new AbortController();
    let raf = 0;
    const draw = () => {
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      onProgress(Math.min(1, v.currentTime / p.seconds));
      if (v.currentTime >= p.seconds) stop.abort();
      raf = requestAnimationFrame(draw);
    };
    const onEnded = () => stop.abort();
    const onAbort = () => stop.abort();
    v.addEventListener("ended", onEnded);
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      await playing;
    } catch {
      throw new Error("Videoen kunne ikke afspilles. Tryk igen.");
    }
    draw();
    sampleFrames(v, frames, stop.signal);
    const clip = await recordClip(stream, Math.ceil(p.seconds) + 1, stop.signal);
    stop.abort();
    cancelAnimationFrame(raf);
    v.removeEventListener("ended", onEnded);
    signal.removeEventListener("abort", onAbort);
    v.pause();
    stream.getTracks().forEach((t) => t.stop());
    void ac?.close().catch(() => {});
    onProgress(1);
    return { clip: signal.aborted ? null : clip, frames };
  })();
}
