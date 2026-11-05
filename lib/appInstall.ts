"use client";

import { useEffect, useState } from "react";

/**
 * Relived som app på hjemmeskærmen (PWA). Holder styr på, om siden er åbnet som app, hvilken telefon det er,
 * og om browseren kan installere med et tryk (Chrome og Edge på Android og computer: beforeinstallprompt).
 * iPhone og iPad kan ikke det; der viser vi i stedet, hvor man trykker (Del → Føj til hjemmeskærm).
 */

export type Platform = "ios" | "android" | "desktop";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** Kaldes én gang fra AppSetup, så tilbuddet fra browseren ikke går tabt, før en knap skal bruge det. */
export function captureInstallPrompt() {
  // Et lille script i rodlayoutet fanger tilbuddet, hvis det kommer, før siden er klar (app/layout.tsx).
  const early = (window as { __rlvPrompt?: InstallPromptEvent }).__rlvPrompt;
  if (early && !deferred) {
    deferred = early;
    emit();
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function platform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** Vis Relived-appens installationsvindue. Giver true, hvis brugeren sagde ja. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  (window as { __rlvPrompt?: unknown }).__rlvPrompt = undefined;
  emit();
  await e.prompt();
  const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" as const }));
  return choice.outcome === "accepted";
}

/** Status til knapper og vejledning. Før siden er indlæst i browseren, er alt "ukendt" (null). */
export function useInstall() {
  const [, bump] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    setReady(true);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  if (!ready) return null;
  return {
    standalone: isStandalone(),
    installed: installedNow || isStandalone(),
    canPrompt: deferred !== null,
    platform: platform(),
  };
}
