"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/**
 * "⋯" ved et show under Mine shows. Planlagte shows kan slettes. Afsluttede shows kan skjules fra listen (salg, ordrer og
 * ting til salg bliver liggende). Live-shows har ingen menu.
 */
export default function ShowMenu({
  id,
  title,
  status,
  hidden,
  canHide,
}: {
  id: string;
  title: string;
  status: "planned" | "live" | "ended";
  hidden: boolean;
  /** Kan skjules (0018_skjul.sql er kørt). */
  canHide: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  // Menuen ligger fast på skærmen under knappen, så den ikke bliver skåret af tabellen.
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  // Placér menuen ved knappen. Er der ikke plads under knappen, åbner menuen opad.
  function place() {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const right = Math.max(8, window.innerWidth - r.right);
    setPos(window.innerHeight - r.bottom < 190 ? { bottom: window.innerHeight - r.top + 6, right } : { top: r.bottom + 6, right });
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    // Ruller siden (fx på mobil lige efter et tryk), følger menuen med knappen i stedet for at lukke.
    let raf = 0;
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  if (status === "live" || (status === "ended" && !canHide)) return null;

  function close() {
    setOpen(false);
    setAsk(false);
  }

  function toggle() {
    if (open) return close();
    place();
    setOpen(true);
  }

  async function remove() {
    setBusy(true);
    const { error } = await getSupabase().from("shows").delete().eq("id", id);
    setBusy(false);
    if (error) return toast(errorText(error));
    close();
    toast(`"${title}" er slettet.`);
    router.refresh();
  }

  async function hide(h: boolean) {
    setBusy(true);
    const { error } = await getSupabase().rpc("set_show_hidden", { p_show: id, p_hidden: h });
    setBusy(false);
    if (error) return toast(errorText(error));
    close();
    toast(h ? `"${title}" er skjult. Du finder det under Vis skjulte shows.` : `"${title}" står i listen igen.`);
    router.refresh();
  }

  return (
    <div className="show-menu" ref={wrap}>
      <button
        ref={btn}
        className="show-menu-btn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Flere valg for ${title}`}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open ? (
        <div className="show-menu-pop" role="menu" style={pos ? { position: "fixed", top: pos.top ?? "auto", bottom: pos.bottom ?? "auto", right: pos.right } : undefined}>
          {status === "planned" ? (
            ask ? (
              <div className="show-menu-ask">
                <p>Slet showet og tingene i køen? Det kan ikke fortrydes.</p>
                <div>
                  <button className="btn btn-red btn-sm" type="button" onClick={remove} disabled={busy}>
                    {busy ? "Sletter …" : "Ja, slet"}
                  </button>
                  <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(false)} disabled={busy}>
                    Fortryd
                  </button>
                </div>
              </div>
            ) : (
              <button className="danger" type="button" role="menuitem" onClick={() => setAsk(true)}>
                Slet show
              </button>
            )
          ) : hidden ? (
            <button type="button" role="menuitem" onClick={() => hide(false)} disabled={busy}>
              Vis i listen igen
            </button>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => hide(true)} disabled={busy}>
                Skjul fra listen
              </button>
              <p className="show-menu-note">Salg, ordrer og ting til salg bliver liggende.</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
