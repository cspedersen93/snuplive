"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SUPPORT_OPEN_EVENT } from "@/lib/support-shared";

const SupportPanel = dynamic(() => import("./SupportPanel"), { ssr: false });

export const SUPPORT_FLAG = "snup-support";

const getFlag = () => {
  try {
    return localStorage.getItem(SUPPORT_FLAG) === "1";
  } catch {
    return false;
  }
};

/**
 * "Hjælp"-knappen nederst til højre på alle sider. Åbner chatten med Relived.
 * Skjult i Backoffice og i et show eller studiet (de har deres egen chat), men kan stadig åbnes
 * fra linket "Skriv til os" i bunden af siden.
 */
export default function SupportChat() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(0);
  const [active, setActive] = useState(false);
  const fab = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const admin = /^\/admin(\/|$)/.test(path);
  const hidden = admin || /^\/(live|studio)\/[^/]+/.test(path) || path === "/klip";

  const show = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) back.current = document.activeElement;
    setMounted(true);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => (fab.current ?? back.current)?.focus());
  }, []);

  // Knapper og links andre steder på siden åbner chatten.
  useEffect(() => {
    window.addEventListener(SUPPORT_OPEN_EVENT, show);
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, show);
  }, [show]);

  // Linket i mailen med svaret: /?hjaelp=<nøgle>. Og ?hjaelp=1 åbner bare chatten.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const token = q.get("hjaelp");
    if (token === null) return;
    q.delete("hjaelp");
    const rest = q.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
    const resume = /^[0-9a-f-]{36}$/i.test(token)
      ? fetch("/api/support/resume", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null)
      : Promise.resolve(null);
    resume.finally(show);
  }, [show]);

  // Ulæste svar på knappen, hvis man har en samtale i gang. Tjekker hvert minut, mens siden er åben.
  useEffect(() => {
    setActive(getFlag());
  }, []);
  useEffect(() => {
    if (open || !active || admin) return;
    let stop = false;
    const peek = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/support?peek=1", { cache: "no-store" });
        const j = (await r.json()) as { thread?: unknown; unread?: number };
        if (stop) return;
        setUnread(j.unread ?? 0);
        if (r.ok && !j.thread) {
          try {
            localStorage.removeItem(SUPPORT_FLAG);
          } catch {}
          setActive(false);
        }
      } catch {}
    };
    peek();
    const t = setInterval(peek, 60_000);
    document.addEventListener("visibilitychange", peek);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", peek);
    };
  }, [open, active, admin]);

  const onSeen = useCallback(() => setUnread(0), []);
  const onThread = useCallback((has: boolean) => {
    try {
      if (has) localStorage.setItem(SUPPORT_FLAG, "1");
      else localStorage.removeItem(SUPPORT_FLAG);
    } catch {}
    setActive(has);
  }, []);

  if (admin && !open) return null;

  return (
    <div className={`sup${open ? " is-open" : ""}`}>
      {!hidden ? (
        <button
          ref={fab}
          type="button"
          className="sup-fab"
          aria-label={open ? "Luk hjælp" : unread ? `Hjælp – ${unread} ${unread === 1 ? "nyt svar" : "nye svar"}` : "Hjælp – skriv til os"}
          aria-expanded={open}
          aria-controls="sup-panel"
          onClick={() => (open ? close() : show())}
        >
          {open ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></svg>
          )}
          <span className="sup-fab-t">{open ? "Luk" : "Hjælp"}</span>
          {unread && !open ? <span className="sup-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</span> : null}
        </button>
      ) : null}
      {mounted ? <SupportPanel open={open} onClose={close} onThread={onThread} onSeen={onSeen} /> : null}
    </div>
  );
}
