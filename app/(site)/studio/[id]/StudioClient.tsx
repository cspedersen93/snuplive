"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Chat from "@/components/Chat";
import { IconBulb } from "@/components/Icons";
import { StudioVideo } from "@/components/LiveVideo";
import MitIdButton from "@/components/MitIdButton";
import { ScreenTop, itemMeta } from "@/components/Screen";
import { useShowRealtime, sortItems } from "@/components/useShowRealtime";
import { AUCTION_SECONDS, auctionLeft, isAuction, soldPrice } from "@/lib/auction";
import { gradFor, kr, when } from "@/lib/format";
import { itemImage, showImage } from "@/lib/images";
import { itemHref } from "@/lib/items";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import type { Item, Message, Profile, Show } from "@/lib/types";
import ItemForm from "./ItemForm";
import { SITE_HOST } from "@/lib/env";

export interface StudioSale {
  id: string;
  item_id: string;
  price: number;
  buyer: { handle: string } | null;
}

interface Props {
  profile: Profile;
  show: Show;
  items: Item[];
  messages: Message[];
  sales: StudioSale[];
  serverNow: number;
  /** MitID er et krav for at gå live, og sælgeren har ikke bekræftet sig endnu. */
  needsMitid?: boolean;
}

const SALE_SELECT = "id,item_id,price,buyer:profiles!sales_buyer_id_fkey(handle)";

function elapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function StudioClient(props: Props) {
  const router = useRouter();
  const sb = getSupabase();
  const me = useMemo(() => ({ id: props.profile.id, handle: props.profile.handle }), [props.profile]);
  const { show, items, messages, setItems, resync } = useShowRealtime({
    show: props.show,
    items: props.items,
    messages: props.messages,
  });
  const [sales, setSales] = useState<StudioSale[]>(props.sales);
  const [offset] = useState(() => props.serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [cameraOn, setCameraOn] = useState(props.show.status === "live");
  const [cameraReady, setCameraReady] = useState(false);
  const [video, setVideo] = useState<{ token: string; url: string } | null>(null);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [viewers, setViewers] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [summary, setSummary] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  // Billede fra kameraet af den ting, der lige er vist frem.
  const [capture, setCapture] = useState<{ key: number; itemId: string } | null>(null);

  const live = show.status === "live";
  const ended = show.status === "ended";
  const current = items.find((i) => i.id === show.current_item_id) ?? null;
  const sold = items.filter((i) => i.status === "sold");
  const revenue = sold.reduce((a, i) => a + soldPrice(i), 0);
  const queued = items.filter((i) => i.status === "queued");
  const next = queued[0] ?? items.find((i) => i.status === "unsold" && i.id !== current?.id) ?? null;
  const shareUrl = `/live/${props.profile.handle}`;

  const fast = Boolean(current?.rush_ends_at || (current?.auction_ends_at && current.status === "live"));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), fast ? 250 : 1000);
    return () => clearInterval(t);
  }, [fast]);

  // Videoadgang til sælgeren, når kameraet tændes.
  useEffect(() => {
    if (!cameraOn || ended) {
      setVideo(null);
      return;
    }
    let alive = true;
    setVideoErr(null);
    fetch("/api/livekit-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ showId: show.id }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Kameraet kunne ikke forbindes.");
        return j as { token: string; url: string };
      })
      .then((j) => alive && setVideo(j))
      .catch((e: Error) => {
        if (!alive) return;
        setVideoErr(e.message);
        setCameraOn(false);
      });
    return () => {
      alive = false;
    };
  }, [cameraOn, ended, show.id]);

  // Hent salg igen, når der bliver købt noget.
  const soldKey = sold.map((i) => i.id).join(",");
  useEffect(() => {
    if (!soldKey) return;
    sb.from("sales")
      .select(SALE_SELECT)
      .eq("show_id", show.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .then(({ data }) => data && setSales(data as unknown as StudioSale[]));
  }, [soldKey, show.id, sb]);

  // Livstegn hvert minut, mens showet er live og kameraet er tændt.
  // Uden livstegn i 15 minutter slutter showet af sig selv (end_stale_shows i databasen).
  useEffect(() => {
    if (!live || !cameraOn) return;
    const beat = () => void sb.rpc("show_heartbeat", { p_show: show.id }).then(({ error }) => error && console.warn("[snuplive] livstegn:", error.message));
    beat();
    const t = setInterval(beat, 60_000);
    const wake = () => document.visibilityState === "visible" && beat();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", beat);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", beat);
    };
  }, [live, cameraOn, sb, show.id]);

  // Advar, hvis sælgeren lukker fanen midt i et show.
  useEffect(() => {
    if (!live) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [live]);

  const onVideoError = useCallback((e: Error) => setVideoErr(e.message || "Forbindelsen til videoen blev afbrudt."), []);
  const onDeviceError = useCallback((text: string) => setVideoErr(text), []);

  // Stillbillede fra kameraet til kortet under "Live nu" (hvert minut, mens showet er live).
  const onSnapshot = useCallback(
    async (jpeg: Blob) => {
      const path = `${me.id}/${show.id}/live.jpg`;
      const up = await sb.storage.from("covers").upload(path, jpeg, { upsert: true, contentType: "image/jpeg", cacheControl: "30" });
      if (up.error) return console.warn("[snuplive] live-billede:", up.error.message);
      await sb.from("shows").update({ cover_path: path, cover_at: new Date().toISOString() }).eq("id", show.id);
    },
    [sb, me.id, show.id],
  );

  const onCapture = useCallback(
    async (jpeg: Blob) => {
      const target = capture?.itemId;
      if (!target) return;
      const it = items.find((x) => x.id === target);
      if (!it || (it.images?.length ?? 0) >= 6) return;
      const path = `${me.id}/${target}/live-${Date.now().toString(36)}.jpg`;
      const up = await sb.storage.from("items").upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (up.error) return console.warn("[snuplive] billede af tingen:", up.error.message);
      const { error } = await sb.rpc("add_item_photo", { p_item: target, p_path: path });
      if (error) console.warn("[snuplive] billede af tingen:", error.message);
    },
    // items ændrer sig hele tiden; vi læser bare den aktuelle liste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capture?.itemId, sb, me.id],
  );

  // Klip af tingen (op til 15 sekunder). Bliver den ikke solgt, vises klippet på annoncen.
  const onClip = useCallback(
    async (itemId: string, video: Blob, ext: "mp4" | "webm") => {
      const path = `${me.id}/${itemId}/clip-${Date.now().toString(36)}.${ext}`;
      const up = await sb.storage.from("clips").upload(path, video, { contentType: video.type, cacheControl: "31536000" });
      if (up.error) return console.warn("[snuplive] klip af tingen:", up.error.message);
      const { data: old, error } = await sb.rpc("set_item_clip", { p_item: itemId, p_path: path });
      if (error) {
        await sb.storage.from("clips").remove([path]);
        return console.warn("[snuplive] klip af tingen:", error.message);
      }
      if (typeof old === "string" && old) await sb.storage.from("clips").remove([old]);
    },
    [sb, me.id],
  );

  async function present(itemId: string) {
    if (await rpc("present_item", { p_item: itemId })) setCapture({ key: Date.now(), itemId });
  }

  async function rpc(name: string, args: Record<string, unknown>, okText?: string) {
    setBusy(true);
    const { error } = await sb.rpc(name, args);
    setBusy(false);
    if (error) {
      toast(errorText(error));
      return false;
    }
    if (okText) toast(okText);
    void resync();
    return true;
  }

  // 3-2-1 og så live.
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      setCount(null);
      void rpc("set_show_status", { p_show: show.id, p_status: "live" }, "Du er live!").then((ok) => {
        // Giv besked til dem, der har trykket "Husk mig".
        if (ok) void fetch(`/api/shows/${show.id}/notify`, { method: "POST" }).catch(() => undefined);
      });
      return;
    }
    const t = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  async function endShow() {
    setConfirmEnd(false);
    if (await rpc("set_show_status", { p_show: show.id, p_status: "ended" })) {
      setCameraOn(false);
      setSummary(true);
    }
  }

  async function deleteShow() {
    setBusy(true);
    const { error } = await sb.from("shows").delete().eq("id", show.id);
    setBusy(false);
    if (error) return toast(errorText(error));
    router.push("/studio");
    router.refresh();
  }

  // ── Køen ──
  const nextPosition = items.reduce((m, i) => Math.max(m, i.position), 0) + 1;
  function saved(it: Item) {
    setItems((xs) => sortItems(xs.some((x) => x.id === it.id) ? xs.map((x) => (x.id === it.id ? it : x)) : [...xs, it]));
    setEditing(null);
  }

  async function removeItem(id: string) {
    const { error } = await sb.from("items").delete().eq("id", id);
    if (error) return toast(errorText(error));
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + shareUrl);
      toast("Linket til dit show er kopieret");
    } catch {
      toast(`Dit link: ${SITE_HOST}${shareUrl}`);
    }
  }

  const rushLeft = current?.rush_ends_at
    ? Math.max(0, Math.ceil((Date.parse(current.rush_ends_at) - (now + offset)) / 1000))
    : null;
  // Budsalg på den ting, der bliver vist.
  const auction = current && isAuction(current) ? current : null;
  const bidLeft = auction ? auctionLeft(auction, now + offset) : null;
  const bidRunning = Boolean(auction && auction.status === "live" && bidLeft !== null && bidLeft > 0);
  // Når uret står på 0, lukker studiet budsalget, så vinderen får tingen med det samme.
  const closing = useRef<string | null>(null);
  useEffect(() => {
    if (!auction || auction.status !== "live" || bidLeft !== 0) return;
    const key = `${auction.id}:${auction.auction_ends_at}`;
    if (closing.current === key) return;
    closing.current = key;
    void sb.rpc("close_auction", { p_item: auction.id }).then(({ data }) => {
      // Går urene en smule forkert, er budsalget måske ikke slut i databasen endnu: prøv igen om lidt.
      if ((data as { status?: string } | null)?.status === "live") setTimeout(() => (closing.current = null), 700);
      void resync();
    });
  }, [auction, bidLeft, now, sb, resync]);
  const saleFor = (itemId: string) => sales.find((s) => s.item_id === itemId);
  const cover = showImage({ ...show, status: "planned", seller: { avatar_path: props.profile.avatar_path } });
  const startedMs = show.started_at ? now + offset - Date.parse(show.started_at) : 0;

  return (
    <div className="wrap">
      <div style={{ paddingTop: 22 }}>
        <nav className="crumbs" aria-label="Brødkrummer">
          <Link href="/konto">Min konto</Link>
          <span aria-hidden="true">/</span>
          <Link href="/studio">Mine shows</Link>
          <span aria-hidden="true">/</span>
          <span>Studie</span>
        </nav>
      </div>
      <div className="studio">
        <aside className="show-side left" aria-label="Køen">
          <div className="box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <h2>Køen</h2>
              <span className="muted" style={{ fontSize: ".85rem" }}>{queued.length} klar · {sold.length} solgt</span>
            </div>
            {items.length ? (
              <ul className="lots queue">
                {items.map((it, n) => {
                  const sale = saleFor(it.id);
                  const canShow = live && it.status !== "sold" && it.id !== current?.id;
                  const canRemove = !ended && (it.status === "queued" || it.status === "unsold");
                  return (
                    editing === it.id ? (
                      <li key={it.id} className="lot-edit">
                        <ItemForm sellerId={me.id} showId={show.id} showCategory={show.category} item={it} onSaved={saved} onCancel={() => setEditing(null)} />
                      </li>
                    ) : (
                    <li key={it.id} className={`lot${it.id === current?.id ? " is-now" : ""}`}>
                      {itemImage(it) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="lot-img" src={itemImage(it) as string} alt="" />
                      ) : (
                        <span className="lot-n" style={{ background: gradFor(it.id) }} aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <strong>{it.name}</strong>
                        <span>
                          {isAuction(it) ? (it.status === "sold" ? `Solgt for ${kr(soldPrice(it))}` : `Budsalg fra ${kr(it.price)}`) : kr(it.price)}
                          {itemMeta(it) ? ` · ${itemMeta(it)}` : ""}
                          {sale?.buyer ? ` · @${sale.buyer.handle}` : ""}
                        </span>
                      </div>
                      <div className="lot-r">
                        {it.id === current?.id ? (
                          <span className="chip live"><span className="live-dot white" />Vises</span>
                        ) : it.status === "sold" ? (
                          <span className="chip mine">Solgt</span>
                        ) : canShow ? (
                          <button className="btn btn-ghost btn-sm" type="button" disabled={busy || bidRunning} onClick={() => present(it.id)}>Vis</button>
                        ) : (
                          <span className={`chip${isAuction(it) && it.status === "queued" ? " bid" : ""}`}>
                            {it.status === "unsold" ? "Ikke solgt" : isAuction(it) ? "Budsalg" : "I køen"}
                          </span>
                        )}
                        {canRemove ? (
                          <span style={{ display: "flex", gap: 10 }}>
                            <button className="linkbtn" type="button" onClick={() => setEditing(it.id)} aria-label={`Ret ${it.name}`}>Ret</button>
                            <button className="linkbtn" type="button" onClick={() => removeItem(it.id)} aria-label={`Fjern ${it.name}`}>Fjern</button>
                          </span>
                        ) : ended && it.status === "unsold" ? (
                          <Link className="linkbtn" href={itemHref(it)}>{it.for_sale ? "Til salg" : "Ikke til salg"}</Link>
                        ) : null}
                      </div>
                    </li>
                    )
                  );
                })}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: ".9rem" }}>Læg de ting ind, du vil vise frem. Med billeder og beskrivelse kan købere finde dem før showet.</p>
            )}
          </div>
          {!ended ? (
            <ItemForm sellerId={me.id} showId={show.id} showCategory={show.category} nextPosition={nextPosition} onSaved={saved} />
          ) : null}
          <div className="box ship-note">
            <IconBulb />
            <span>Vis mærket og målene tæt på kameraet, og svar på spørgsmålene højt. Det giver flere salg.</span>
          </div>
        </aside>

        <div style={{ minWidth: 0 }}>
          <div className="studio-bar">
            <div style={{ minWidth: 0 }}>
              <h1 className="h3">{show.title}</h1>
              <span className="muted" style={{ fontSize: ".9rem" }}>
                {live ? "Du er live" : ended ? "Showet er slut" : when(show.starts_at)} ·{" "}
                <button className="linkbtn" type="button" onClick={copyLink}>Kopiér link til showet</button>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {live ? (
                <span className="chip live"><span className="live-dot white" />Live</span>
              ) : (
                <span className="chip">{ended ? "Slut" : "Ikke live"}</span>
              )}
              <span className="timer">{live ? elapsed(startedMs) : "00:00"}</span>
            </div>
          </div>
          <div className="player">
            <div className="screen">
              {cameraOn && video ? (
                <StudioVideo
                  token={video.token}
                  url={video.url}
                  onViewers={setViewers}
                  onError={onVideoError}
                  onDeviceError={onDeviceError}
                  onCamera={setCameraReady}
                  onSnapshot={onSnapshot}
                  snapshotEvery={live ? 60000 : null}
                  captureKey={live ? (capture?.key ?? null) : null}
                  onCapture={onCapture}
                  clip={live ? capture : null}
                  onClip={onClip}
                />
              ) : live ? (
                <div className="screen-dark" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="feed" src={cover} alt="" />
              )}
              <div className="shade" />
              <ScreenTop handle={props.profile.handle} avatarPath={props.profile.avatar_path} area={props.profile.area} live={live} viewers={viewers} />

              {!live && !ended ? (
                <div className="pre-live">
                  {count !== null ? (
                    <div className="count" aria-live="assertive">{count}</div>
                  ) : props.needsMitid ? (
                    <>
                      <strong style={{ fontSize: "1.3rem" }}>Bekræft, hvem du er</strong>
                      <span style={{ maxWidth: "30ch" }}>Før du går live første gang, skal du bekræfte dig med MitID. Det tager et minut.</span>
                      <MitIdButton next={`/studio/${show.id}`} />
                    </>
                  ) : !cameraOn ? (
                    <>
                      <strong style={{ fontSize: "1.3rem" }}>Klar til at gå live?</strong>
                      <span style={{ maxWidth: "30ch" }}>Tænd kameraet, og tjek billede og lyd. Ingen kan se dig, før du trykker Gå live.</span>
                      <button className="btn btn-red" type="button" onClick={() => setCameraOn(true)}>Tænd kameraet</button>
                    </>
                  ) : (
                    <>
                      <strong style={{ fontSize: "1.3rem" }}>Klar til at gå live?</strong>
                      <ul className="checks">
                        <li className={cameraReady ? "" : "wait"}>{cameraReady ? "Kamera og mikrofon virker" : "Venter på kameraet …"}</li>
                        <li className={queued.length ? "" : "wait"}>{queued.length ? `${queued.length} ting i køen` : "Læg ting i køen"}</li>
                      </ul>
                      <button className="btn btn-red" type="button" disabled={!cameraReady || busy} onClick={() => setCount(3)}>
                        <span className="live-dot white" aria-hidden="true" />
                        Gå live
                      </button>
                    </>
                  )}
                  {videoErr ? <span className="err-msg" role="alert">{videoErr}</span> : null}
                </div>
              ) : null}

              {live && !cameraOn ? (
                <div className="pre-live">
                  <strong style={{ fontSize: "1.2rem" }}>Kameraet er slukket</strong>
                  <span>Dine seere kan ikke se dig lige nu. Tænder du ikke kameraet igen inden 15 minutter, slutter showet af sig selv.</span>
                  <button className="btn btn-red" type="button" onClick={() => setCameraOn(true)}>Tænd kameraet igen</button>
                  {videoErr ? <span className="err-msg" role="alert">{videoErr}</span> : null}
                </div>
              ) : live && videoErr ? (
                <div className="stage-msg err-msg">{videoErr}</div>
              ) : null}

              {ended ? (
                <div className="pre-live">
                  <strong style={{ fontSize: "1.3rem" }}>Showet er slut</strong>
                  <span>{sold.length} solgt for {kr(revenue)}</span>
                  <Link className="btn btn-red btn-sm" href="/studio">Til mine shows</Link>
                </div>
              ) : null}

              {live ? (
                <>
                  {current?.status === "sold" ? (
                    <div className="v-flag">
                      Solgt{saleFor(current.id)?.buyer ? ` til @${saleFor(current.id)?.buyer?.handle}` : current.high_handle ? ` til @${current.high_handle}` : ""}
                      {isAuction(current) ? ` for ${kr(soldPrice(current))}` : ""}!
                    </div>
                  ) : auction && auction.status === "unsold" && auction.auction_ends_at ? (
                    <div className="v-flag">Ingen bud</div>
                  ) : null}
                  {bidRunning ? (
                    <div className="v-rush bid" role="timer">Budsalg <span>{bidLeft}</span></div>
                  ) : null}
                  {current && current.status !== "sold" && rushLeft !== null ? (
                    <div className="v-rush" role="timer">{rushLeft > 0 ? <>Lynrunde <span>{rushLeft}</span></> : "Lynrunden er slut"}</div>
                  ) : null}
                  <div className="v-card">
                    <span
                      className="v-thumb"
                      style={
                        current && itemImage(current)
                          ? { backgroundImage: `url("${itemImage(current)}")`, backgroundSize: "cover", backgroundPosition: "center" }
                          : { background: current ? gradFor(current.id) : "rgba(255,255,255,.12)" }
                      }
                      aria-hidden="true"
                    >
                      {current && !itemImage(current) ? String(items.indexOf(current) + 1).padStart(2, "0") : current ? "" : "…"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="v-pin">{current ? (auction ? "Budsalg" : "Vises nu") : "Ingen ting vises"}</div>
                      <div className="v-name">{current ? current.name : next ? `Næste: ${next.name}` : "Køen er tom"}</div>
                      <div className="v-meta">
                        {auction
                          ? auction.high_bid
                            ? `Højeste bud: ${auction.high_handle} · ${auction.bid_count} ${auction.bid_count === 1 ? "bud" : "bud"}`
                            : auction.auction_ends_at
                              ? "Ingen bud endnu"
                              : `Start ${kr(auction.price)} · Tryk Start budsalg`
                          : current
                            ? itemMeta(current) || " "
                            : "Tryk Vis næste"}
                      </div>
                    </div>
                    {current ? (
                      <span className="v-buy" aria-hidden="true">{kr(auction?.high_bid ?? current.price)}</span>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div className="studio-ctrl">
            <div className="box">
              <div className="ticker">
                <div><span className="k">Seere</span><span className="v">{live ? viewers : 0}</span></div>
                <div><span className="k">Solgt</span><span className="v">{sold.length}</span></div>
                <div><span className="k">Omsætning</span><span className="v">{kr(revenue)}</span></div>
              </div>
            </div>
            <div className="box" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="ctrl">
                <button className="btn btn-ghost" type="button" disabled={!live || busy || !next || bidRunning} onClick={() => next && present(next.id)}>
                  Vis næste
                </button>
                {auction ? (
                  <button
                    className="btn btn-red"
                    type="button"
                    disabled={!live || busy || auction.status !== "live" || Boolean(auction.auction_ends_at)}
                    onClick={() => rpc("start_auction", { p_item: auction.id, p_seconds: AUCTION_SECONDS })}
                  >
                    {bidRunning ? `Budsalg ${bidLeft} s` : auction.auction_ends_at ? "Budsalget er slut" : `Start budsalg ${AUCTION_SECONDS} s`}
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={!live || busy || !current || current.status === "sold" || (rushLeft ?? 0) > 0}
                    onClick={() => current && rpc("start_rush", { p_item: current.id, p_seconds: 10 })}
                  >
                    Lynrunde 10 s
                  </button>
                )}
              </div>
              <button className="btn btn-line btn-block" type="button" disabled={!live || busy} onClick={() => setConfirmEnd(true)}>
                Afslut show
              </button>
            </div>
          </div>
          {live ? (
            <p className="fine" style={{ textAlign: "center", marginTop: 10 }}>
              Hold studiet åbent og kameraet tændt. Er de slukket i 15 minutter, slutter showet af sig selv. Når du viser en ting frem,
              gemmer vi de første 15 sekunder som video på tingens side, hvis den ikke bliver solgt.
            </p>
          ) : null}
          {!live && !ended ? (
            <p className="fine" style={{ textAlign: "center", marginTop: 10 }}>
              Planlagte shows kan slettes.{" "}
              <button className="linkbtn" type="button" onClick={deleteShow} disabled={busy}>Slet showet</button>
            </p>
          ) : null}
        </div>

        <aside className="show-side" aria-label="Styring og chat">
          <Chat showId={show.id} messages={messages} me={me} live={live} loginHref="/login" hint="Seerne skriver her" canModerate />
        </aside>
      </div>

      {confirmEnd ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="m-end">
          <div className="modal-card">
            <span className="label red">Afslut show</span>
            <h2 className="h2" id="m-end" style={{ fontSize: "2rem" }}>Vil du afslutte showet?</h2>
            <p className="muted">Videoen stopper for alle seere. Ting, der ikke er solgt, bliver sat til salg til fast pris, så de kan købes bagefter.</p>
            <div className="ctas">
              <button className="btn btn-red" type="button" onClick={endShow}>Ja, afslut</button>
              <button className="btn btn-line" type="button" onClick={() => setConfirmEnd(false)}>Fortsæt showet</button>
            </div>
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="m-sum">
          <div className="modal-card">
            <span className="label red">Showet er slut</span>
            <h2 className="h2" id="m-sum" style={{ fontSize: "2rem" }}>Flot show, {props.profile.display_name || props.profile.handle}!</h2>
            <div className="ticker" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
              <div><span className="k">Solgte ting</span><span className="v">{sold.length}</span></div>
              <div><span className="k">Omsætning</span><span className="v">{kr(revenue)}</span></div>
            </div>
            <p className="muted">
              {items.length - sold.length
                ? `${items.length - sold.length} ting blev ikke solgt. De er nu til salg til fast pris under Til salg. Du kan rette prisen eller tage dem af under Mine shows.`
                : "Alt blev solgt. Godt gået!"}
            </p>
            <div className="ctas">
              <Link className="btn btn-red" href="/studio">Til mine shows</Link>
              <button className="btn btn-line" type="button" onClick={() => setSummary(false)}>Luk</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
