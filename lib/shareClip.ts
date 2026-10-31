"use client";

import { clipMimeType } from "@/lib/clipRecorder";

// En video til TikTok, Instagram og Facebook: klippet af tingen, lodret (9:16), med Relived-logo, navn, pris og "relived.dk",
// og til sidst et kort slutbillede med logoet. Laves i browseren ved at afspille klippet og optage det igen, så det tager
// lige så lang tid som klippet (plus 2 sekunder). Lyden kommer med, hvor browseren kan læse den.

const W = 720;
const H = 1280;
const END_MS = 2000;
const FONT = '"Familjen Grotesk Variable", "Familjen Grotesk", Arial, sans-serif';
const MONO = '"Geist Mono Variable", "Geist Mono", "Courier New", monospace';

export interface ShareClipInfo {
  name: string;
  price: number;
}

export interface ShareClip {
  blob: Blob;
  ext: "mp4" | "webm";
  type: string;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function waitFor(el: HTMLMediaElement, ev: string, ms: number) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Videoen kunne ikke åbnes.")), ms);
    el.addEventListener(
      ev,
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
    el.addEventListener("error", () => {
      clearTimeout(t);
      reject(new Error("Videoen kunne ikke åbnes."));
    }, { once: true });
  });
}

/** Deler teksten i højst `max` linjer, der passer i bredden (den sidste får … , hvis der er mere). */
function lines(ctx: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= width || !cur) cur = next;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length <= max) return out;
  const kept = out.slice(0, max);
  let last = kept[max - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const kr = (n: number) => `${n.toLocaleString("da-DK")} kr`;

/**
 * Laver videoen. Skal kaldes direkte fra et tryk (lyden kræver det). `onProgress` får 0..1.
 * Kaster en fejl med en dansk tekst, hvis browseren ikke kan.
 */
export async function makeShareClip(src: string, info: ShareClipInfo, onProgress: (share: number) => void, signal: AbortSignal): Promise<ShareClip> {
  const type = clipMimeType();
  const canvas = document.createElement("canvas");
  if (!type || typeof canvas.captureStream !== "function") {
    throw new Error("Din browser kan ikke lave videoen. Prøv i Chrome eller Safari på telefonen.");
  }
  // Lyden: laves i trykket, ellers må den ikke starte.
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const ac = AC ? new AC() : null;
  void ac?.resume().catch(() => {});

  const cleanup: (() => void)[] = [() => void ac?.close().catch(() => {})];
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error("Videoen kunne ikke hentes. Prøv igen.");
    const bytes = await res.arrayBuffer();
    if (signal.aborted) throw new DOMException("Afbrudt", "AbortError");
    const url = URL.createObjectURL(new Blob([bytes], { type: res.headers.get("content-type") || "video/mp4" }));
    cleanup.push(() => URL.revokeObjectURL(url));

    // Lyden læses for sig (så videoen kan afspilles uden lyd, hvad alle browsere tillader).
    let sound: AudioBuffer | null = null;
    if (ac) {
      try {
        sound = await ac.decodeAudioData(bytes.slice(0));
      } catch {
        sound = null;
      }
    }

    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await waitFor(v, "loadeddata", 15000);
    const seconds = Number.isFinite(v.duration) && v.duration > 0 ? Math.min(v.duration, 60) : 15;

    const [logo] = await Promise.all([
      loadImage("/img/logo.svg"),
      document.fonts?.load(`700 44px ${FONT}`).catch(() => undefined),
      document.fonts?.load(`500 22px ${MONO}`).catch(() => undefined),
    ]);

    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Din browser kan ikke lave videoen.");

    // Tekstfeltet nederst måles én gang.
    ctx.font = `700 44px ${FONT}`;
    const nameLines = lines(ctx, info.name, W - 80, 2);

    const drawFrame = () => {
      ctx.fillStyle = "#0E0C0F";
      ctx.fillRect(0, 0, W, H);
      // Lodrette klip fylder billedet (9:16). Vandrette (fx fra en computer) står helt i midten, med en dæmpet
      // forstørret udgave bagved, så tingen ikke bliver skåret væk.
      const vw = v.videoWidth || W;
      const vh = v.videoHeight || H;
      const cover = Math.max(W / vw, H / vh);
      if (vw / vh <= 0.8) {
        ctx.drawImage(v, (W - vw * cover) / 2, (H - vh * cover) / 2, vw * cover, vh * cover);
      } else {
        ctx.globalAlpha = 0.3;
        ctx.drawImage(v, (W - vw * cover) / 2, (H - vh * cover) / 2, vw * cover, vh * cover);
        ctx.globalAlpha = 1;
        const fit = Math.min(W / vw, 640 / vh);
        ctx.drawImage(v, (W - vw * fit) / 2, 170 + (640 - vh * fit) / 2, vw * fit, vh * fit);
      }
      // TikTok og Instagram lægger deres egne knapper og tekst over den nederste femtedel og øverst, så navn, pris og logo
      // står inden for det, der altid kan ses. Mørk overgang bag teksten, så den kan læses.
      const g = ctx.createLinearGradient(0, H - 620, 0, H - 120);
      g.addColorStop(0, "rgba(8,5,10,0)");
      g.addColorStop(0.55, "rgba(8,5,10,0.78)");
      g.addColorStop(1, "rgba(8,5,10,0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(0, H - 620, W, 620);
      // Logo øverst til venstre (under appens faner).
      if (logo) {
        const lh = 40;
        const lw = (logo.naturalWidth / logo.naturalHeight) * lh || 136;
        ctx.fillStyle = "rgba(8,5,10,0.45)";
        roundRect(ctx, 28, 104, lw + 32, lh + 24, 16);
        ctx.fill();
        ctx.drawImage(logo, 44, 116, lw, lh);
      }
      // Navn, pris og adresse.
      ctx.fillStyle = "#F6F0EB";
      ctx.font = `700 44px ${FONT}`;
      ctx.textBaseline = "alphabetic";
      const baseY = H - 340;
      nameLines.forEach((l, i) => ctx.fillText(l, 40, baseY - (nameLines.length - 1 - i) * 52));
      const price = kr(info.price);
      ctx.font = `700 36px ${FONT}`;
      const pw = ctx.measureText(price).width + 40;
      ctx.fillStyle = "#EB0029";
      roundRect(ctx, 40, H - 308, pw, 60, 30);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(price, 60, H - 266);
      ctx.fillStyle = "#F6F0EB";
      ctx.font = `600 30px ${FONT}`;
      ctx.fillText("Køb den på relived.dk", 40 + pw + 24, H - 267);
    };

    const drawEnd = () => {
      ctx.fillStyle = "#0E0C0F";
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 520);
      g.addColorStop(0, "#4A0E1C");
      g.addColorStop(1, "#0E0C0F");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (logo) {
        const lw = 420;
        const lh = (logo.naturalHeight / logo.naturalWidth) * lw || 124;
        ctx.drawImage(logo, (W - lw) / 2, H / 2 - lh - 20, lw, lh);
      }
      ctx.textAlign = "center";
      ctx.fillStyle = "#FF5A70";
      ctx.font = `500 26px ${MONO}`;
      ctx.fillText("LIVE SALE. SECOND HAND.", W / 2, H / 2 + 50);
      ctx.fillStyle = "#F6F0EB";
      ctx.font = `700 48px ${FONT}`;
      ctx.fillText("relived.dk", W / 2, H / 2 + 130);
      ctx.textAlign = "left";
    };

    drawFrame();
    const stream = canvas.captureStream(30);
    const dest = ac && sound ? ac.createMediaStreamDestination() : null;
    dest?.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    cleanup.push(() => stream.getTracks().forEach((t) => t.stop()));

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
    rec.start(500);

    await v.play();
    if (dest && sound && ac) {
      const s = ac.createBufferSource();
      s.buffer = sound;
      s.connect(dest);
      s.start();
      cleanup.push(() => {
        try {
          s.stop();
        } catch {
          // Allerede stoppet
        }
      });
    }

    // Klippet, så slutbilledet. Tegnes hver frame, også hvis browseren springer frames over.
    await new Promise<void>((resolve, reject) => {
      let endAt = 0;
      let raf = 0;
      const tick = () => {
        if (signal.aborted) {
          cancelAnimationFrame(raf);
          return reject(new DOMException("Afbrudt", "AbortError"));
        }
        const done = v.ended || v.currentTime >= seconds - 0.05;
        if (!done) {
          drawFrame();
          onProgress(Math.min(0.95, (v.currentTime / seconds) * 0.9));
        } else {
          if (!endAt) {
            endAt = performance.now();
            v.pause();
          }
          drawEnd();
          const t = performance.now() - endAt;
          onProgress(Math.min(0.99, 0.9 + (t / END_MS) * 0.1));
          if (t >= END_MS) return resolve();
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    rec.stop();
    await stopped;
    onProgress(1);
    const ext = type.startsWith("video/mp4") ? "mp4" : "webm";
    return { blob: new Blob(chunks, { type: type.split(";")[0] }), ext, type: type.split(";")[0] };
  } finally {
    cleanup.forEach((f) => f());
  }
}
