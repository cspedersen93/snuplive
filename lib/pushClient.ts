"use client";

// Besked på telefonen (web push) i browseren. Virker i Chrome, Edge og Firefox og på Android.
// På iPhone/iPad kun, når Relived er lagt på hjemmeskærmen (Del → Føj til hjemmeskærm).

export type PushSupport = "yes" | "ios-install" | "no";
export type PushState = "on" | "off" | "denied";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "no";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "yes";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone ? "ios-install" : "no";
}

async function registration() {
  return navigator.serviceWorker.getRegistration("/");
}

export async function pushState(): Promise<PushState> {
  if (pushSupport() !== "yes") return "off";
  if (Notification.permission === "denied") return "denied";
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

function keyBytes(b64url: string) {
  const b64 = (b64url + "=".repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Skal kaldes direkte fra et tryk på en knap (browseren spørger om lov). */
export async function enablePush(): Promise<"on" | "denied" | "error"> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const r = await fetch("/api/push");
    if (!r.ok) return "error";
    const { key } = (await r.json()) as { key: string };
    let sub = await reg.pushManager.getSubscription();
    // En gammel adresse med en anden nøgle virker ikke: lav en ny.
    const current = sub?.options?.applicationServerKey;
    if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))) !== btoa(String.fromCharCode(...keyBytes(key)))) {
      await sub.unsubscribe();
      sub = null;
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    const save = await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return save.ok ? "on" : "error";
  } catch (e) {
    console.warn("[relived] besked på telefonen:", e);
    return "error";
  }
}

/** Er beskeder slået til i browseren, gemmes adressen igen hos os (fx hvis en anden konto har brugt browseren). */
export async function syncPush() {
  try {
    if (pushSupport() !== "yes" || Notification.permission !== "granted") return;
    const sub = await (await registration())?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  } catch {
    // Prøver igen næste gang
  }
}

export async function disablePush() {
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  } catch {
    // Allerede slået fra
  }
}
