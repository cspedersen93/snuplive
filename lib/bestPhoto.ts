"use client";

import { frameFromVideo } from "@/lib/resizeImage";

// Billedet af tingen: i stedet for ét billede lige efter "Vis" tager studiet flere billeder, mens tingen vises
// (samme 15 sekunder som klippet), og vælger bagefter det bedste. Claude vælger, hvis nøglen er sat op i Vercel.
// Ellers vælger telefonen selv det skarpeste.

/** Hvornår der tages billeder (sekunder efter "Vis"). */
export const PHOTO_TIMES = [1.2, 3, 5, 7.5, 10, 13];

export interface PhotoCandidate {
  /** Det billede, der gemmes på tingen (1080 × 1350). */
  full: Blob;
  /** Lille udgave, som Claude ser (512 × 640). */
  small: Blob;
  /** Hvor skarpt billedet er (højere er skarpere). */
  sharp: number;
}

/** Hvor skarpt billedet er lige nu: variansen af kanterne i en lille gråtoneudgave. */
export function sharpness(video: HTMLVideoElement) {
  try {
    if (!video.videoWidth || video.readyState < 2) return 0;
    const w = 128;
    const h = 160;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;
    const s = Math.max(w / video.videoWidth, h / video.videoHeight);
    const dw = video.videoWidth * s;
    const dh = video.videoHeight * s;
    ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const d = ctx.getImageData(0, 0, w, h).data;
    const g = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    let sum = 0;
    let sq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
        sum += lap;
        sq += lap * lap;
        n++;
      }
    }
    const mean = sum / n;
    return sq / n - mean * mean;
  } catch {
    return 0;
  }
}

export async function takeCandidate(video: HTMLVideoElement): Promise<PhotoCandidate | null> {
  try {
    const sharp = sharpness(video);
    const [full, small] = await Promise.all([frameFromVideo(video, 1080, 1350, 0.82), frameFromVideo(video, 512, 640, 0.7)]);
    return full && small ? { full, small, sharp } : null;
  } catch {
    return null;
  }
}

/**
 * Telefonens eget valg, når Claude ikke er sat op eller ikke svarer: det skarpeste billede.
 * Det første billede tages lige efter "Vis", hvor sælgeren tit kigger på skærmen, så det tæller lidt mindre.
 */
export function localPick(c: PhotoCandidate[]) {
  let best = 0;
  let score = -1;
  c.forEach((p, i) => {
    const s = p.sharp * (i === 0 && c.length > 2 ? 0.7 : 1);
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return best;
}

export function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}
