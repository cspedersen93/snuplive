"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import Chat from "@/components/Chat";
import { IconBox, IconShare } from "@/components/Icons";
import { ViewerVideo } from "@/components/LiveVideo";
import { ScreenTop, itemMeta } from "@/components/Screen";
import { useMe } from "@/components/useMe";
import { useShowRealtime } from "@/components/useShowRealtime";
import { hasSupabase } from "@/lib/env";
import { gradFor, kr, when } from "@/lib/format";
import { showImage } from "@/lib/images";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import type { Item, Message, Profile, Show } from "@/lib/types";

interface Props {
  seller: Pick<Profile, "id" | "handle" | "display_name" | "area" | "avatar_path">;
  show: Show;
  items: Item[];
  messages: Message[];
  serverNow: number;
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function countdown(ms: number) {
  if (ms <= 0) return "om et øjeblik";
  const min = Math.round(ms / 60000);
  if (min < 60) return `om ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `om ${h} t ${min % 60} min`;
  return `om ${Math.round(h / 24)} dage`;
}

function LotChip({ item, mine }: { item: Item; mine: boolean }) {
  if (item.status === "live")
    return (
      <span className="chip live">
        <span className="live-dot white" />
        Vises nu
      </span>
    );
  if (item.status === "sold") return <span className={`chip ${mine ? "mine" : "sold"}`}>{mine ? "Din" : "Solgt"}</span>;
  if (item.status === "unsold") return <span className="chip">Ikke solgt</span>;
  return <span className="chip">I køen</span>;
}

export default function ShowClient(props: Props) {
  const router = useRouter();
  const me = useMe();
  const { show, items, messages } = useShowRealtime({ show: props.show, items: props.items, messages: props.messages });
  const [offset] = useState(() => props.serverNow - Date.now());
  const [video, setVideo] = useState<{ token: string; url: string } | null>(null);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [viewers, setViewers] = useState(0);
  const [mine, setMine] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const live = show.status === "live";
  const current = items.find((i) => i.id === show.current_item_id) ?? null;
  const rushing = Boolean(current?.rush_ends_at);
  const now = useNow(rushing ? 250 : live ? 5000 : 30000);
  const handle = props.seller.handle;
  const loginHref = `/login?next=${encodeURIComponent(`/live/${handle}`)}`;
  const meKey = me === undefined ? "wait" : (me?.id ?? "guest");

  // Hent en videoadgang, når showet er live.
  useEffect(() => {
    if (!live) {
      setVideo(null);
      return;
    }
    if (meKey === "wait") return;
    let alive = true;
    fetch("/api/livekit-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ showId: show.id }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Videoen kunne ikke starte.");
        return j as { token: string; url: string };
      })
      .then((j) => {
        if (!alive) return;
        setVideo(j);
        setVideoErr(null);
      })
      .catch((e: Error) => alive && setVideoErr(e.message));
    return () => {
      alive = false;
    };
  }, [live, show.id, meKey]);

  // Hvilke ting i showet har jeg snuppet?
  useEffect(() => {
    if (!me) return;
    getSupabase()
      .from("sales")
      .select("item_id")
      .eq("show_id", show.id)
      .eq("buyer_id", me.id)
      .then(({ data }) => {
        if (data) setMine(new Set(data.map((d) => d.item_id as string)));
      });
  }, [me, show.id]);

  // Går sælgeren live i et andet show, skifter siden til det.
  useEffect(() => {
    if (!hasSupabase) return;
    const sb = getSupabase();
    const ch = sb
      .channel(`seller:${props.seller.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shows", filter: `seller_id=eq.${props.seller.id}` },
        (p) => {
          const s = p.new as Show;
          if (s.id !== show.id && s.status === "live") router.refresh();
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [props.seller.id, show.id, router]);

  const onVideoError = useCallback((e: Error) => setVideoErr(e.message || "Forbindelsen til videoen blev afbrudt."), []);

  const rushLeft = current?.rush_ends_at
    ? Math.max(0, Math.ceil((Date.parse(current.rush_ends_at) - (now + offset)) / 1000))
    : null;

  async function snup() {
    if (!current || busy) return;
    if (!me) {
      router.push(loginHref);
      return;
    }
    setBusy(true);
    const { error } = await getSupabase().rpc("snup", { p_item: current.id });
    setBusy(false);
    if (error) {
      toast(errorText(error));
      return;
    }
    setMine((s) => new Set(s).add(current.id));
    window.dispatchEvent(new Event("snup:changed"));
    toast(`Du snuppede ${current.name}!`, "/kurv", "Mine snup");
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: show.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Linket er kopieret");
      }
    } catch {
      // Brugeren lukkede delingsmenuen
    }
  }

  const sold = current?.status === "sold";
  const isMine = current ? mine.has(current.id) : false;
  let buyLabel = me === null ? `Log ind og snup` : `Snup ${current ? kr(current.price) : ""}`;
  let buyDisabled = busy || !current || !live;
  if (current && sold) {
    buyLabel = isMine ? "Din!" : "Solgt";
    buyDisabled = true;
  } else if (rushLeft === 0) {
    buyLabel = "Slut";
    buyDisabled = true;
  }

  const cover = showImage({ ...show, status: "planned", seller: props.seller });
  const startsIn = show.starts_at ? Date.parse(show.starts_at) - (now + offset) : null;
  const chatLines = messages.slice(-5);
  const soldCount = items.filter((i) => i.status === "sold").length;

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Brødkrummer" style={{ paddingTop: 22 }}>
        <Link href="/">Forside</Link>
        <span aria-hidden="true">/</span>
        <Link href="/live">Live nu</Link>
        <span aria-hidden="true">/</span>
        <span>{handle}</span>
      </nav>
      <div className="show-wrap">
        <aside className="show-side left" aria-label="Om showet">
          <div className="box seller-box">
            <div className="seller-row">
              <Avatar handle={handle} path={props.seller.avatar_path} />
              <div>
                <strong>{handle}</strong>
                <span className="muted" style={{ fontSize: ".88rem" }}>
                  {[props.seller.display_name, props.seller.area].filter(Boolean).join(" · ") || "Sælger på SnupLive"}
                </span>
              </div>
            </div>
            <button className="btn btn-line btn-sm" type="button" onClick={share} style={{ alignSelf: "flex-start" }}>
              Del showet
            </button>
          </div>
          <div className="box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <h2>I dette show</h2>
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {items.length} ting{soldCount ? ` · ${soldCount} solgt` : ""}
              </span>
            </div>
            {items.length ? (
              <ul className="lots">
                {items.map((it, n) => (
                  <li key={it.id} className={`lot${it.id === show.current_item_id ? " is-now" : ""}`}>
                    <span className="lot-n" style={{ background: gradFor(it.id) }} aria-hidden="true">
                      {String(n + 1).padStart(2, "0")}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong>{it.name}</strong>
                      <span>{itemMeta(it) || " "}</span>
                    </div>
                    <div className="lot-r">
                      <span className="price">{kr(it.price)}</span>
                      <LotChip item={it} mine={mine.has(it.id)} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: ".9rem" }}>Sælgeren har ikke lagt ting ind endnu.</p>
            )}
          </div>
          <div className="box ship-note">
            <IconBox />
            <span>Alt, du snupper i dette show, bliver samlet under Mine snup, så det kan sendes i én pakke.</span>
          </div>
        </aside>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <h1 className="show-title">{show.title}</h1>
          <div className="player">
            <div className="screen">
              {live && video ? (
                <ViewerVideo token={video.token} url={video.url} onViewers={setViewers} onError={onVideoError} />
              ) : live ? (
                <div className="screen-dark" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="feed" src={cover} alt="" />
              )}
              <div className="shade" />
              <ScreenTop handle={handle} avatarPath={props.seller.avatar_path} area={props.seller.area} live={live} viewers={viewers} />

              {!live ? (
                <div className="pre-live">
                  {show.status === "planned" ? (
                    <>
                      <span className="label" style={{ color: "#fff" }}>Næste show</span>
                      <strong style={{ fontSize: "1.4rem", lineHeight: 1.2 }}>{when(show.starts_at)}</strong>
                      {startsIn !== null ? <span>{countdown(startsIn)}</span> : null}
                      <span style={{ fontSize: ".85rem", opacity: 0.8 }}>Siden skifter selv til video, når showet starter.</span>
                    </>
                  ) : (
                    <>
                      <strong style={{ fontSize: "1.4rem" }}>Showet er slut</strong>
                      <span>{soldCount ? `${soldCount} ting blev snuppet.` : "Tak fordi du kiggede forbi."}</span>
                      <Link className="btn btn-red btn-sm" href="/live">Find et andet show</Link>
                    </>
                  )}
                </div>
              ) : videoErr ? (
                <div className="stage-msg err-msg">{videoErr}</div>
              ) : !video ? (
                <div className="stage-msg">Forbinder til showet …</div>
              ) : null}

              {live ? (
                <>
                  <div className="v-chat" aria-hidden="true">
                    {chatLines.map((m) =>
                      m.kind === "event" ? (
                        <div key={m.id} className="msg event">{m.body}</div>
                      ) : (
                        <div key={m.id} className={`msg${m.from_seller ? " seller" : ""}`} style={{ ["--c" as string]: gradFor(m.handle) }}>
                          <i />
                          <div>
                            <b>{m.handle}</b>
                            {m.body}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                  {current && sold && isMine ? <div className="v-flag">Du snuppede den!</div> : null}
                  {current && !sold && rushLeft !== null && rushLeft > 0 ? (
                    <div className="v-rush" role="timer">
                      Lynrunde <span>{rushLeft}</span>
                    </div>
                  ) : null}
                  <div className="v-card">
                    <span className="v-thumb" style={{ background: current ? gradFor(current.id) : "rgba(255,255,255,.12)" }} aria-hidden="true">
                      {current ? String(items.indexOf(current) + 1).padStart(2, "0") : "…"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="v-pin">{current ? "Vises nu" : "Om lidt"}</div>
                      <div className="v-name">{current ? current.name : "Sælgeren finder næste ting frem"}</div>
                      <div className="v-meta">{current ? itemMeta(current) || kr(current.price) : "Hold øje med chatten"}</div>
                    </div>
                    {current ? (
                      <button className="v-buy" type="button" onClick={snup} disabled={buyDisabled}>
                        {buyLabel}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          {live ? (
            <p className="fine" style={{ textAlign: "center" }}>
              Når du snupper, vises dit brugernavn i chatten. Du betaler samlet under Mine snup inden 3 dage.
            </p>
          ) : null}
        </div>

        <aside className="show-side" aria-label="Chat">
          <Chat showId={show.id} messages={messages} me={me} live={live} loginHref={loginHref} canModerate={Boolean(me && me.id === show.seller_id)} />
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn btn-line btn-block" href="/kurv">Mine snup</Link>
            <button className="icon-btn" type="button" onClick={share} aria-label="Del showet">
              <IconShare stroke="currentColor" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
