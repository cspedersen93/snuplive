"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import { IconMute, IconPlay, IconSound } from "@/components/Icons";
import { itemMeta } from "@/components/Screen";
import { loadClips, type FeedClip } from "@/lib/clipFeed";
import { hasSupabase } from "@/lib/env";
import { kr } from "@/lib/format";
import { clipUrl, storageUrl } from "@/lib/images";
import { itemHref } from "@/lib/items";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/**
 * "Swipe og køb": ét klip ad gangen i fuld højde. Swipe (eller pil op/ned) for det næste.
 * Klippet, man kigger på, afspilles; resten står stille. Lyden slås til én gang for alle klip.
 */
export default function ClipFeed({ initial, batch }: { initial: FeedClip[]; batch: number }) {
  const router = useRouter();
  const [clips, setClips] = useState(initial);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [bought, setBought] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const loading = useRef(false);
  const offset = useRef(batch);
  const [done, setDone] = useState(initial.length < batch);

  // Hele skærmen: siden bag feedet må ikke rulle med.
  useEffect(() => {
    document.documentElement.classList.add("clip-open");
    setStill(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    if (hasSupabase)
      getSupabase()
        .auth.getSession()
        .then(({ data }) => setUid(data.session?.user.id ?? null));
    else setUid(null);
    return () => document.documentElement.classList.remove("clip-open");
  }, []);

  // Hvilket klip er på skærmen?
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll<HTMLElement>(".clip-slide").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [clips.length]);

  // Afspil det aktive klip, sæt de andre på pause.
  useEffect(() => {
    const cur = clips[active];
    videos.current.forEach((v, id) => {
      if (id !== cur?.id) {
        if (!v.paused) v.pause();
        return;
      }
      v.muted = muted;
      if (still || paused) return v.pause();
      v.play().catch(() => {
        // Browseren vil ikke afspille med lyd uden et tryk: afspil uden lyd.
        if (!v.muted) {
          v.muted = true;
          setMuted(true);
          v.play().catch(() => {});
        }
      });
    });
  }, [active, clips, muted, paused, still]);

  // Hent flere, når man nærmer sig bunden.
  const more = useCallback(async () => {
    if (loading.current || done || !hasSupabase) return;
    loading.current = true;
    const next = await loadClips(getSupabase(), offset.current, batch);
    loading.current = false;
    if (!next) return setDone(true);
    offset.current += batch;
    if (next.length < batch) setDone(true);
    setClips((list) => {
      const seen = new Set(list.map((c) => c.id));
      return [...list, ...next.filter((c) => !seen.has(c.id))];
    });
  }, [batch, done]);
  useEffect(() => {
    if (active >= clips.length - 3) void more();
  }, [active, clips.length, more]);

  // Til næste/forrige klip (pil op/ned, knapperne på computeren).
  const go = useCallback(
    (delta: number) => {
      const root = scroller.current;
      if (!root) return;
      const last = done ? clips.length : clips.length - 1; // til sidst kommer "Du har set alle klip"
      const to = Math.max(0, Math.min(last, active + delta));
      root.querySelector<HTMLElement>(`[data-i="${to}"]`)?.scrollIntoView({ behavior: still ? "auto" : "smooth" });
    },
    [active, clips.length, done, still],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        go(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === " " && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => setPaused(false), [active]);

  async function buy(c: FeedClip) {
    setBusy(c.id);
    const { error } = await getSupabase().rpc("buy_now", { p_item: c.id });
    setBusy(null);
    if (error) return toast(errorText(error));
    setBought((b) => ({ ...b, [c.id]: true }));
    window.dispatchEvent(new Event("snup:changed"));
    toast("Den er din! Betal under Mine køb.", "/kurv", "Mine køb");
  }

  async function share(c: FeedClip) {
    const url = `${window.location.origin}${itemHref(c)}`;
    try {
      if (navigator.share) return await navigator.share({ title: c.name, text: `${c.name} · ${kr(c.price)} på Relived`, url });
      await navigator.clipboard.writeText(url);
      toast("Linket er kopieret.");
    } catch {
      // Delingen blev afbrudt
    }
  }

  function close() {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push("/til-salg");
  }

  return (
    <div className="clipfeed">
      <div className="clip-bar">
        <button className="clip-icon" type="button" onClick={close} aria-label="Luk">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1>Swipe og køb</h1>
        <button className="clip-icon" type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Slå lyden til" : "Slå lyden fra"} aria-pressed={!muted}>
          {muted ? <IconMute /> : <IconSound />}
        </button>
      </div>

      <div className="clip-nav" aria-label="Skift klip">
        <button className="clip-icon" type="button" onClick={() => go(-1)} disabled={active === 0} aria-label="Forrige klip">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
        <button className="clip-icon" type="button" onClick={() => go(1)} disabled={active >= (done ? clips.length : clips.length - 1)} aria-label="Næste klip">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <div className="clip-scroll" ref={scroller} role="feed" aria-label="Klip af ting til salg">
        {clips.map((c, i) => {
          const poster = c.images?.[0] ? storageUrl("items", c.images[0]) : undefined;
          const near = Math.abs(i - active) <= 1;
          const meta = itemMeta(c);
          const isMine = uid === c.seller_id;
          const sold = bought[c.id];
          return (
            <article className="clip-slide" key={c.id} data-i={i} aria-posinset={i + 1} aria-setsize={done ? clips.length : -1} aria-label={c.name}>
              <div className="clip-stage">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="clip-bg" src={poster} alt="" aria-hidden="true" loading={near ? "eager" : "lazy"} />
                ) : null}
                <video
                  ref={(el) => {
                    if (el) videos.current.set(c.id, el);
                    else videos.current.delete(c.id);
                  }}
                  src={near ? (clipUrl(c) ?? undefined) : undefined}
                  poster={poster}
                  muted
                  loop
                  playsInline
                  preload={i === active ? "auto" : near ? "metadata" : "none"}
                  onClick={() => setPaused((p) => !p)}
                  aria-label={`${c.name}, video af tingen`}
                />
                {i === active && (paused || still) ? (
                  <button className="clip-play" type="button" onClick={() => (still ? (setStill(false), setPaused(false)) : setPaused(false))} aria-label="Afspil">
                    <IconPlay />
                  </button>
                ) : null}

                <div className="clip-side">
                  <button className="clip-icon" type="button" onClick={() => share(c)} aria-label="Del tingen">
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5" />
                    </svg>
                  </button>
                </div>

                <div className="clip-info">
                  <div className="clip-seller">
                    <Link href={`/live/${c.seller?.handle}`} className="clip-handle">
                      <Avatar handle={c.seller?.handle ?? "s"} path={c.seller?.avatar_path ?? null} size={32} />
                      <span>@{c.seller?.handle}</span>
                    </Link>
                    {i === active && c.seller ? (
                      <FollowButton sellerId={c.seller_id} handle={c.seller.handle} next={`/klip?ting=${c.id}`} className="btn btn-line btn-sm clip-follow" />
                    ) : null}
                  </div>
                  <h2 className="clip-name">
                    <Link href={itemHref(c)}>{c.name}</Link>
                  </h2>
                  <p className="clip-meta">
                    <strong className="num">{kr(c.price)}</strong>
                    {meta ? <span> · {meta}</span> : null}
                  </p>
                  <div className="clip-ctas">
                    {sold ? (
                      <Link className="btn btn-line" href="/kurv">Din! Betal under Mine køb</Link>
                    ) : isMine ? (
                      <Link className="btn btn-line" href={itemHref(c)}>Din egen ting</Link>
                    ) : uid === null ? (
                      <Link className="btn btn-red" href={`/login?next=${encodeURIComponent(`/klip?ting=${c.id}`)}`}>
                        Log ind og køb · {kr(c.price)}
                      </Link>
                    ) : (
                      <button className="btn btn-red" type="button" onClick={() => buy(c)} disabled={busy === c.id || uid === undefined}>
                        {busy === c.id ? "Reserverer …" : `Køb nu · ${kr(c.price)}`}
                      </button>
                    )}
                    <Link className="btn btn-ghost" href={itemHref(c)}>Se tingen</Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {done ? (
          <article className="clip-slide clip-end" data-i={clips.length}>
            <div className="clip-stage">
              <div className="clip-endbox">
                <strong>Du har set alle klip</strong>
                <p>Følg sælgerne, så får du besked, når de går live med nye ting.</p>
                <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
                <Link className="btn btn-line" href="/til-salg">Alt til salg</Link>
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
