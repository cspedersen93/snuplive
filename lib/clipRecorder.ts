"use client";

// Korte klip af tingene fra live-showet. Optages i sælgerens browser med MediaRecorder.

/** Hvor mange sekunder vi optager, når sælgeren viser en ting frem. */
export const CLIP_SECONDS = 15;
/** Kortere klip end det gemmer vi ikke (sælgeren gik videre med det samme). */
export const CLIP_MIN_MS = 4000;

// MP4 virker overalt (også iPhone); WebM bruges kun, hvor browseren ikke kan optage MP4.
const TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function clipMimeType(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export interface Clip {
  blob: Blob;
  ext: "mp4" | "webm";
  ms: number;
}

/**
 * Optag et klip fra kameraet (og mikrofonen, hvis den er med i streamen). Stopper efter `seconds`,
 * eller tidligere, hvis `signal` afbrydes (sælgeren viser den næste ting). Giver null, hvis browseren
 * ikke kan optage.
 */
export function recordClip(stream: MediaStream, seconds: number, signal: AbortSignal): Promise<Clip | null> {
  const type = clipMimeType();
  if (!type) return Promise.resolve(null);
  return new Promise((resolve) => {
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 64_000 });
    } catch {
      return resolve(null);
    }
    const chunks: Blob[] = [];
    const start = Date.now();
    let settled = false;
    const finish = (clip: Clip | null) => {
      if (settled) return;
      settled = true;
      resolve(clip);
    };
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      const base = type.split(";")[0];
      const blob = new Blob(chunks, { type: base });
      finish(blob.size ? { blob, ext: base === "video/mp4" ? "mp4" : "webm", ms: Date.now() - start } : null);
    };
    rec.onerror = () => finish(null);
    const stop = () => {
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        finish(null);
      }
    };
    const timer = setTimeout(stop, seconds * 1000);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        stop();
      },
      { once: true },
    );
    try {
      rec.start(1000);
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}
