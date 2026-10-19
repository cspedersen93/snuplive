"use client";

/** Skærer et billede til (center) og skalerer det ned, så det fylder lidt. Returnerer en JPEG. */
export async function resizeImage(file: Blob, width: number, height: number, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    return await drawCover(bitmap, bitmap.width, bitmap.height, width, height, quality);
  } finally {
    bitmap.close();
  }
}

/** Tager et stillbillede fra en video (fx sælgerens kamera). */
export async function frameFromVideo(video: HTMLVideoElement, width: number, height: number, quality = 0.75) {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return null;
  return drawCover(video, video.videoWidth, video.videoHeight, width, height, quality);
}

function drawCover(
  src: CanvasImageSource,
  sw: number,
  sh: number,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Billedet kunne ikke behandles."));
  const scale = Math.max(width / sw, height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, (width - dw) / 2, (height - dh) / 2, dw, dh);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Billedet kunne ikke gemmes."))), "image/jpeg", quality),
  );
}
