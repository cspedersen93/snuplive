"use client";

import { useEffect, useRef, useState } from "react";
import { SITE_URL } from "@/lib/env";
import { kr } from "@/lib/format";
import { makeShareClip } from "@/lib/shareClip";
import { toast } from "@/lib/toast";
import { track } from "@/lib/track";

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "klip"
  );
}

/**
 * "Lav video til TikTok og Instagram": klippet af tingen med Relived-logo, navn, pris og relived.dk.
 * Bagefter kan sælgeren dele den direkte fra telefonen (hvor det kan lade sig gøre) eller hente den.
 */
export default function ShareClipButton({ src, name, price, href }: { src: string; name: string; price: number; href: string }) {
  const [state, setState] = useState<"idle" | "busy" | "ready">("idle");
  const [pct, setPct] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const link = `${SITE_URL}${href}`;

  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  async function make() {
    const c = new AbortController();
    ctrl.current = c;
    setState("busy");
    setPct(0);
    try {
      const out = await makeShareClip(src, { name, price }, setPct, c.signal);
      const f = new File([out.blob], `relived-${slug(name)}.${out.ext}`, { type: out.type });
      setFile(f);
      setUrl(URL.createObjectURL(f));
      try {
        setCanShare(Boolean(navigator.canShare?.({ files: [f] })));
      } catch {
        setCanShare(false);
      }
      setState("ready");
      track("Delte klip");
    } catch (e) {
      setState("idle");
      if ((e as Error)?.name === "AbortError") return;
      toast((e as Error)?.message || "Videoen kunne ikke laves. Prøv igen.");
    }
  }

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: name, text: `${name} · ${kr(price)} på Relived: ${link}` });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast("Videoen kunne ikke deles herfra. Tryk Hent videoen, og læg den op i appen.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast("Linket er kopieret. Sæt det ind i teksten til dit opslag.");
    } catch {
      toast(link);
    }
  }

  if (state === "busy")
    return (
      <span className="share-clip" role="status">
        <span className="share-clip-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(pct * 100)}%` }} />
        </span>
        <span className="muted">
          Laver videoen … {Math.round(pct * 100)} %. Hold siden åben.{" "}
          <button className="linkbtn" type="button" onClick={() => ctrl.current?.abort()}>Stop</button>
        </span>
      </span>
    );

  if (state === "ready" && file && url)
    return (
      <span className="share-clip ready">
        <video className="share-clip-preview" src={url} muted playsInline loop autoPlay aria-label={`Video af ${name} til sociale medier`} />
        <span className="share-clip-side">
          <span className="share-clip-actions">
            {canShare ? (
              <button className="btn btn-red btn-sm" type="button" onClick={share}>Del videoen</button>
            ) : null}
            <a className={`btn btn-sm ${canShare ? "btn-line" : "btn-red"}`} href={url} download={file.name}>Hent videoen</a>
            <button className="btn btn-line btn-sm" type="button" onClick={copy}>Kopiér link</button>
          </span>
          <span className="muted">Læg den op på TikTok, Instagram eller Facebook, og sæt linket ind i teksten, så køberne kan finde varen.</span>
        </span>
      </span>
    );

  return (
    <span className="share-clip">
      <button className="linkbtn share-clip-start" type="button" onClick={make}>
        Lav video til TikTok og Instagram
      </button>
    </span>
  );
}
