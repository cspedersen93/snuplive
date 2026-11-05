"use client";

import { useEffect } from "react";
import { captureInstallPrompt, isStandalone } from "@/lib/appInstall";

/**
 * Det, appen skal bruge på alle sider (lægges i rodlayoutet):
 * - gemmer browserens tilbud om at installere, så knappen "Hent appen" kan bruge det,
 * - registrerer public/sw.js (beskeder, siden uden net og tallet på ikonet),
 * - sætter klassen is-app på <html>, når Relived er åbnet fra hjemmeskærmen (fx til tilbage-knappen),
 * - fjerner tallet på app-ikonet, når appen åbnes.
 */
export default function AppSetup() {
  useEffect(() => {
    captureInstallPrompt();
    const app = isStandalone();
    document.documentElement.classList.toggle("is-app", app);

    const clearBadge = () => {
      if (document.visibilityState !== "visible") return;
      const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
      nav.clearAppBadge?.().catch(() => undefined);
    };
    clearBadge();
    document.addEventListener("visibilitychange", clearBadge);

    // Service workeren registreres, når siden er færdig, så den ikke forsinker første visning.
    let idle: number | undefined;
    if ("serviceWorker" in navigator && window.isSecureContext) {
      const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
      idle = window.setTimeout(register, document.readyState === "complete" ? 1500 : 4000);
    }
    return () => {
      document.removeEventListener("visibilitychange", clearBadge);
      if (idle) clearTimeout(idle);
    };
  }, []);
  return null;
}
