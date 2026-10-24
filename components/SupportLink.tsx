"use client";

import { SUPPORT_OPEN_EVENT } from "@/lib/support-shared";

/** Knap, der åbner supportchatten (fx "Skriv til os" i bunden af siden). */
export default function SupportLink({ children = "Skriv til os", className = "sup-link" }: { children?: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={className} aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event(SUPPORT_OPEN_EVENT))}>
      {children}
    </button>
  );
}
