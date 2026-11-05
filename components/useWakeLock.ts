"use client";

import { useEffect } from "react";

/**
 * Holder skærmen tændt, mens active er sand (fx når sælgeren er live med telefonen på en stander).
 * Browseren slipper låsen, når fanen skjules, så den tages igen, når man kommer tilbage. Kan browseren ikke, sker intet.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const take = async () => {
      if (stopped || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Fx når batterisparetilstand er slået til. Så slukker skærmen som normalt.
      }
    };
    void take();
    const onVisible = () => void take();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => undefined);
    };
  }, [active]);
}
