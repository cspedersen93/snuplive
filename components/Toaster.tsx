"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ToastDetail } from "@/lib/toast";

export default function Toaster() {
  const [t, setT] = useState<ToastDetail | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ToastDetail>).detail;
      setT(d);
      setShow(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShow(false), 3600);
    };
    window.addEventListener("snup:toast", on);
    return () => window.removeEventListener("snup:toast", on);
  }, []);

  return (
    <div className={`toast${show ? " show" : ""}`} role="status" aria-live="polite">
      <span>{t?.text}</span>
      {t?.href ? <Link href={t.href}>{t.linkText ?? "Se mere"}</Link> : null}
    </div>
  );
}
