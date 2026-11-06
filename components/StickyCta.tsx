"use client";

import { useEffect, useRef, useState } from "react";

/**
 * På telefonen fylder billedet hele første skærm på en vareside, så Køb-knappen ikke kan ses. Når sidens røde knap
 * (den første .btn-red i `.item-cta`) er ude af syne, står navn, pris og samme knap fast nederst over bundmenuen.
 * Et tryk på den faste knap trykker på sidens egen knap, så det altid er samme handling og samme tekst.
 */
export default function StickyCta({ name, price }: { name: string; price: string }) {
  const [main, setMain] = useState<HTMLElement | null>(null);
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState("");
  const [disabled, setDisabled] = useState(false);
  const box = useRef<HTMLElement | null>(null);

  useEffect(() => {
    box.current = document.querySelector<HTMLElement>(".item-cta");
    if (!box.current) return;
    const read = () => {
      const btn = box.current?.querySelector<HTMLElement>(".btn-red") ?? null;
      setMain(btn);
      setLabel(btn ? (btn.innerText || "").replace(/\s+/g, " ").trim() : "");
      setDisabled(Boolean(btn && (btn as HTMLButtonElement).disabled));
    };
    read();
    // Knappen skifter tekst (fx når man er logget ind, eller varen er reserveret).
    const mo = new MutationObserver(read);
    mo.observe(box.current, { subtree: true, childList: true, characterData: true, attributes: true });
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0 });
    io.observe(box.current);
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  const visible = show && Boolean(main) && Boolean(label);
  useEffect(() => {
    document.body.classList.toggle("has-sticky-cta", visible);
    return () => document.body.classList.remove("has-sticky-cta");
  }, [visible]);

  if (!main || !label) return null;
  return (
    <div className={"sticky-cta" + (visible ? " is-on" : "")} aria-hidden={!visible}>
      <div className="sticky-cta-t">
        <span className="sticky-cta-name">{name}</span>
        <strong className="sticky-cta-price num">{price}</strong>
      </div>
      <button type="button" className="btn btn-red" tabIndex={visible ? 0 : -1} disabled={disabled} onClick={() => main.click()}>
        {label.replace(/\s*·\s*\d[\d.]*\s*kr\.?$/i, "")}
      </button>
    </div>
  );
}
