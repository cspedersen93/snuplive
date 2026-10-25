"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COOKIE_NOTICE_KEY } from "@/lib/cookies";

/**
 * Besked første gang: Relived bruger kun nødvendige cookies (ingen reklame eller sporing), så der skal ikke siges ja eller nej.
 * Forsvinder, når man trykker OK, og kommer ikke igen på den enhed.
 */
export default function CookieNotice() {
  const path = usePathname();
  const [show, setShow] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Automatiske browsere (test og robotter) får ikke beskeden.
    if (navigator.webdriver) return;
    try {
      setShow(localStorage.getItem(COOKIE_NOTICE_KEY) !== "1");
    } catch {
      // Browseren gemmer ikke noget (fx privat vindue). Så viser vi ikke beskeden, for den ville komme hver gang.
      setShow(false);
    }
  }, []);

  // Knappen "Hjælp" flyttes op over beskeden på telefonen, så de ikke ligger oven i hinanden.
  const hidden = !show || path === "/klip" || path === "/cookies";
  useEffect(() => {
    const root = document.documentElement;
    if (hidden || !box.current) {
      root.style.removeProperty("--cookie-h");
      return;
    }
    // Beskedens højde plus lidt luft.
    const set = () => root.style.setProperty("--cookie-h", `${(box.current?.offsetHeight ?? 0) + 12}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--cookie-h");
    };
  }, [hidden]);

  function ok() {
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, "1");
    } catch {
      // Gemmes ikke. Beskeden forsvinder alligevel nu.
    }
    setShow(false);
  }

  if (hidden) return null;
  return (
    <div ref={box} className="cookie-note" role="region" aria-label="Om cookies">
      <p>
        <b>Cookies:</b> Vi bruger kun dem, der skal til, for at du kan logge ind, købe og sælge. Ingen reklame eller sporing.{" "}
        <Link href="/cookies">Læs mere</Link>
      </p>
      <button className="btn btn-red btn-sm" type="button" onClick={ok}>
        OK
      </button>
    </div>
  );
}
