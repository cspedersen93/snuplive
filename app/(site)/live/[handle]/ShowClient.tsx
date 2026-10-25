"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import ReportButton from "@/components/ReportButton";
import SellerFacts from "@/components/SellerFacts";
import Chat from "@/components/Chat";
import { IconBox, IconShare, IconShieldCheck } from "@/components/Icons";
import { ViewerVideo } from "@/components/LiveVideo";
import FollowButton from "@/components/FollowButton";
import Reactions from "@/components/Reactions";
import RemindButton from "@/components/RemindButton";
import { PushOffer } from "@/components/PushOffer";
import { ScreenTop, itemMeta } from "@/components/Screen";
import { useMe } from "@/components/useMe";
import { useShowRealtime } from "@/components/useShowRealtime";
import { hasSupabase } from "@/lib/env";
import { auctionLeft, isAuction, nextBid, soldPrice } from "@/lib/auction";
import { gradFor, kr, when } from "@/lib/format";
import { itemImage, showImage } from "@/lib/images";
import { itemHref } from "@/lib/items";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import type { CamLayout, Item, Message, Profile, SellerFactsData, Show } from "@/lib/types";
import type { Guest } from "@/lib/guests";
import type { Room } from "livekit-client";

interface Props {
  seller: Pick<Profile, "id" | "handle" | "display_name" | "area" | "avatar_path"> & SellerFactsData;
  show: Show;
  items: Item[];
  messages: Message[];
  serverNow: number;
  /** Ting, Relived har ægthedstjekket. */
  authOk?: string[];
  /** Gæster i showet (andre sælgere, der sælger med). */
  guests?: Guest[];
  /** Side om side eller fokus på den, der viser (værten vælger). */
  camLayout?: CamLayout;
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

function LotChip({ item, mine, ended }: { item: Item; mine: boolean; ended: boolean }) {
  if (item.status === "live" && isAuction(item))
    return (
      <span className="chip live">
        <span className="live-dot white" />
        Budsalg
      </span>
    );
  if (item.status === "live")
    return (
      <span className="chip live">
        <span className="live-dot white" />
        Vises nu
      </span>
    );
  if (item.status === "sold") return <span className={`chip ${mine ? "mine" : "sold"}`}>{mine ? "Din" : "Solgt"}</span>;
  if (item.status === "unsold" && ended && item.for_sale) return <span className="chip ok">Køb nu</span>;
  if (item.status === "unsold") return <span className="chip">Ikke solgt</span>;
  if (isAuction(item)) return <span className="chip bid">Budsalg</span>;
  return <span className="chip">I køen</span>;
}

export default function ShowClient(props: Props) {
  const router = useRouter();
  const me = useMe();
  const { show, items, messages } = useShowRealtime({ show: props.show, items: props.items, messages: props.messages });
  const [offset] = useState(() => props.serverNow - Date.now());
  const [video, setVideo] = useState<{ token: string; url: string } | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  // Følger man sælgeren via knappen på videoen, kommer tilbuddet om besked på telefonen under videoen.
  const [pushAsk, setPushAsk] = useState(false);
  const onFollowed = useCallback(() => setPushAsk(true), []);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [viewers, setViewers] = useState(0);
  const [mine, setMine] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const live = show.status === "live";
  const current = items.find((i) => i.id === show.current_item_id) ?? null;
  const rushing = Boolean(current?.rush_ends_at || (current?.auction_ends_at && current.status === "live"));
  const now = useNow(rushing ? 250 : live ? 5000 : 30000);
  const handle = props.seller.handle;
  const loginHref = `/login?next=${encodeURIComponent(`/live/${handle}`)}`;
  const meKey = me === undefined ? "wait" : (me?.id ?? "guest");
  // Gæster i showet: hentes igen hvert 30. sekund, mens showet er live (en gæst kan komme med undervejs).
  const [guests, setGuests] = useState<Guest[]>(props.guests ?? []);
  useEffect(() => {
    if (!live || !hasSupabase) return;
    const sb = getSupabase();
    const t = setInterval(() => {
      void sb
        .from("show_guests")
        .select("joined_at,guest:profiles!show_guests_guest_id_fkey(id,handle,display_name,avatar_path)")
        .eq("show_id", show.id)
        .is("left_at", null)
        .order("joined_at")
        .then(({ data, error }) => {
          if (error || !data) return;
          setGuests((data as unknown as { guest: Guest | null }[]).map((r) => r.guest).filter((g): g is Guest => Boolean(g)));
        });
    }, 30_000);
    return () => clearInterval(t);
  }, [live, show.id]);
  // Hvem sælger tingen? Værten, eller en gæst (også en gæst, der er gået).
  const [names, setNames] = useState<Record<string, string>>({});
  const ownerOf = (it: Item) =>
    it.seller_id === props.seller.id ? null : (guests.find((g) => g.id === it.seller_id)?.handle ?? names[it.seller_id] ?? "sælger");
  const unknownKey = [...new Set(items.map((i) => i.seller_id))]
    .filter((id) => id !== props.seller.id && !guests.some((g) => g.id === id) && !(id in names))
    .join(",");
  useEffect(() => {
    if (!unknownKey || !hasSupabase) return;
    void getSupabase()
      .from("profiles")
      .select("id,handle")
      .in("id", unknownKey.split(","))
      .then(({ data }) => {
        const got = Object.fromEntries(((data ?? []) as { id: string; handle: string }[]).map((p) => [p.id, p.handle]));
        setNames((n) => ({ ...n, ...Object.fromEntries(unknownKey.split(",").map((id) => [id, got[id] ?? "sælger"])) }));
      });
  }, [unknownKey]);
  const multi = guests.length > 0 || items.some((i) => i.seller_id !== props.seller.id);
  const [layout, setLayout] = useState<CamLayout>(props.camLayout ?? "split");
  useEffect(() => {
    if (show.cam_layout) setLayout(show.cam_layout);
  }, [show.cam_layout]);

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

  // Hvilke ting i showet har jeg købt?
  useEffect(() => {
    if (!me) return;
    getSupabase()
      .from("sales")
      .select("item_id")
      .eq("show_id", show.id)
      .eq("buyer_id", me.id)
      .neq("status", "cancelled")
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

  // Budsalg på den ting, der bliver vist.
  const auction = current && isAuction(current) ? current : null;
  const bidLeft = auction ? auctionLeft(auction, now + offset) : null;
  const bidRunning = Boolean(auction && auction.status === "live" && bidLeft !== null && bidLeft > 0);
  const leading = Boolean(me && auction?.high_bidder === me.id);
  const bidAmount = auction ? nextBid(auction.price, auction.high_bid) : 0;

  // Når uret står på 0, beder seerne også om at lukke budsalget (med lidt forskudt tid, så ikke alle gør det på én gang).
  const closing = useRef<string | null>(null);
  useEffect(() => {
    if (!auction || auction.status !== "live" || bidLeft !== 0 || !hasSupabase) return;
    const key = `${auction.id}:${auction.auction_ends_at}`;
    if (closing.current === key) return;
    closing.current = key;
    const t = setTimeout(() => {
      void getSupabase()
        .rpc("close_auction", { p_item: auction.id })
        .then(({ data }) => {
          if ((data as { status?: string } | null)?.status === "live") setTimeout(() => (closing.current = null), 1000);
        });
    }, 1200 + Math.random() * 1500);
    return () => clearTimeout(t);
    // Kun når budsalget eller uret skifter, ikke ved hver ny tegning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction?.id, auction?.auction_ends_at, auction?.status, bidLeft]);

  // Vinder du budsalget, får du besked med det samme.
  const won = useRef<string | null>(null);
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    const before = lastStatus.current;
    lastStatus.current = auction ? `${auction.id}:${auction.status}` : null;
    // Kun når budsalget slutter, mens du ser med (ikke hvis du åbner siden bagefter).
    if (!me || !auction || auction.status !== "sold" || auction.high_bidder !== me.id || won.current === auction.id) return;
    if (before !== `${auction.id}:live`) return;
    won.current = auction.id;
    setMine((s) => new Set(s).add(auction.id));
    window.dispatchEvent(new Event("snup:changed"));
    toast(`Du vandt ${auction.name} for ${kr(soldPrice(auction))}!`, "/kurv", "Mine køb");
  }, [me, auction]);

  async function bid() {
    if (!auction || busy) return;
    if (!me) {
      router.push(loginHref);
      return;
    }
    setBusy(true);
    const { error } = await getSupabase().rpc("place_bid", { p_item: auction.id, p_amount: bidAmount });
    setBusy(false);
    if (error) toast(errorText(error));
  }

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
    toast(`Du købte ${current.name}!`, "/kurv", "Mine køb");
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
  let buyLabel = me === null ? `Log ind og køb` : `Køb ${current ? kr(current.price) : ""}`;
  let buyDisabled = busy || !current || !live;
  if (current && sold) {
    buyLabel = isMine || leading ? "Din!" : "Solgt";
    buyDisabled = true;
  } else if (auction) {
    if (!auction.auction_ends_at) {
      buyLabel = "Starter snart";
      buyDisabled = true;
    } else if (!bidRunning) {
      buyLabel = auction.status === "unsold" ? "Ingen bud" : "Slut";
      buyDisabled = true;
    } else if (leading) {
      buyLabel = "Du fører";
      buyDisabled = true;
    } else {
      buyLabel = me === null ? "Log ind og byd" : `Byd ${kr(bidAmount)}`;
      buyDisabled = busy || !live;
    }
  } else if (rushLeft === 0) {
    buyLabel = "Slut";
    buyDisabled = true;
  }

  const cover = showImage({ ...show, status: "planned", seller: props.seller });
  const startsIn = show.starts_at ? Date.parse(show.starts_at) - (now + offset) : null;
  const chatLines = messages.slice(-5);
  const soldCount = items.filter((i) => i.status === "sold").length;
  const isMineItem = (it: Item) => mine.has(it.id) || Boolean(me && it.status === "sold" && it.high_bidder === me.id);
  const ended = show.status === "ended";
  const forSaleCount = ended ? items.filter((i) => i.status === "unsold" && i.for_sale).length : 0;
  const currentImg = current ? itemImage(current) : null;

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
                  {[props.seller.display_name, props.seller.area].filter(Boolean).join(" · ") || "Sælger på Relived"}
                </span>
              </div>
            </div>
            <FollowButton sellerId={props.seller.id} handle={handle} next={`/live/${handle}`} className="btn btn-red btn-sm" />
            <SellerFacts seller={props.seller} />
            {guests.length ? (
              <div className="show-guests">
                <span className="label">Sælger sammen med</span>
                {guests.map((g) => (
                  <Link key={g.id} className="show-guest" href={`/live/${g.handle}`}>
                    <Avatar handle={g.handle} path={g.avatar_path} size={30} />
                    <span>
                      <b>@{g.handle}</b>
                      {g.display_name ? <span className="muted"> · {g.display_name}</span> : null}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
            <button className="btn btn-line btn-sm" type="button" onClick={share} style={{ alignSelf: "flex-start" }}>
              Del showet
            </button>
          </div>
          <div className="box" id="i-showet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <h2>I dette show</h2>
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {items.length} ting{soldCount ? ` · ${soldCount} solgt` : ""}
              </span>
            </div>
            {items.length ? (
              <ul className="lots">
                {items.map((it, n) => {
                  const img = itemImage(it);
                  return (
                    <li key={it.id} className={`lot${it.id === show.current_item_id ? " is-now" : ""}`}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="lot-img" src={img} alt="" loading="lazy" />
                      ) : (
                        <span className="lot-n" style={{ background: gradFor(it.id) }} aria-hidden="true">
                          {String(n + 1).padStart(2, "0")}
                        </span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        {/* Under showet bliver man på siden; før og efter kan man åbne tingens egen side. */}
                        <strong>{live ? it.name : <Link href={itemHref(it)}>{it.name}</Link>}</strong>
                        <span>{itemMeta(it) || " "}</span>
                        {ownerOf(it) ? <span className="lot-owner">fra @{ownerOf(it)}</span> : null}
                      </div>
                      <div className="lot-r">
                        <span className="price">
                          {isAuction(it) && it.status === "live" && it.high_bid
                            ? `bud ${kr(it.high_bid)}`
                            : isAuction(it) && it.status !== "sold" && !(ended && it.for_sale)
                              ? `fra ${kr(it.price)}`
                              : kr(soldPrice(it))}
                        </span>
                        <LotChip item={it} mine={isMineItem(it)} ended={ended} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: ".9rem" }}>Sælgeren har ikke lagt ting ind endnu.</p>
            )}
          </div>
          <div className="box ship-note">
            <IconBox />
            <span>
              {multi
                ? "Alt, du køber, bliver samlet under Mine køb. Du får én pakke fra hver sælger i showet."
                : `Alt, du køber hos ${handle}, bliver samlet under Mine køb, så det kan sendes i én pakke.`}
            </span>
          </div>
          <ReportButton type="show" id={show.id} className="show-report" />
        </aside>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <h1 className="show-title">{show.title}</h1>
          <div className="player">
            <div className="screen">
              {live && video ? (
                <ViewerVideo
                  token={video.token}
                  url={video.url}
                  onViewers={setViewers}
                  onError={onVideoError}
                  spotlight={current?.seller_id ?? null}
                  layout={layout}
                  onRoom={setRoom}
                />
              ) : live ? (
                <div className="screen-dark" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="feed" src={cover} alt="" />
              )}
              <div className="shade" />
              <ScreenTop
                handle={handle}
                avatarPath={props.seller.avatar_path}
                area={props.seller.area}
                live={live}
                viewers={viewers}
                guests={guests}
                action={
                  live ? (
                    <FollowButton sellerId={props.seller.id} handle={handle} next={`/live/${handle}`} className="v-follow" compact onFollowed={onFollowed} />
                  ) : null
                }
              />

              {!live ? (
                <div className="pre-live">
                  {show.status === "planned" ? (
                    <>
                      <span className="label" style={{ color: "#fff" }}>Næste show</span>
                      <strong style={{ fontSize: "1.4rem", lineHeight: 1.2 }}>{when(show.starts_at)}</strong>
                      {startsIn !== null ? <span>{countdown(startsIn)}</span> : null}
                      <span style={{ fontSize: ".85rem", opacity: 0.8 }}>Siden skifter selv til video, når showet starter.</span>
                      <RemindButton showId={show.id} next={`/live/${handle}`} className="btn btn-red btn-sm" />
                    </>
                  ) : (
                    <>
                      <strong style={{ fontSize: "1.4rem" }}>Showet er slut</strong>
                      <span>
                        {soldCount ? `${soldCount} ting blev solgt.` : "Tak fordi du kiggede forbi."}
                        {forSaleCount ? ` ${forSaleCount} ting kan stadig købes til fast pris.` : ""}
                      </span>
                      {forSaleCount ? (
                        <a className="btn btn-red btn-sm" href="#i-showet">Se hvad der er tilbage</a>
                      ) : (
                        <Link className="btn btn-red btn-sm" href="/live">Find et andet show</Link>
                      )}
                      <FollowButton sellerId={props.seller.id} handle={handle} next={`/live/${handle}`} label={`Følg @${handle}, og få besked næste gang`} />
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
                  {current && sold && (isMine || leading) ? (
                    <div className="v-flag">{auction ? "Du vandt budsalget!" : "Du købte den!"}</div>
                  ) : current && sold && auction?.high_handle ? (
                    <div className="v-flag">Solgt til {auction.high_handle}</div>
                  ) : bidRunning && leading ? (
                    <div className="v-flag">Du har det højeste bud</div>
                  ) : null}
                  {current && !sold && rushLeft !== null && rushLeft > 0 ? (
                    <div className="v-rush" role="timer">
                      Lynrunde <span>{rushLeft}</span>
                    </div>
                  ) : null}
                  {bidRunning ? (
                    <div className="v-rush bid" role="timer" aria-label={`Budsalg, ${bidLeft} sekunder tilbage`}>
                      Budsalg <span>{bidLeft}</span>
                    </div>
                  ) : null}
                  <div className="v-card">
                    {currentImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="v-thumb" src={currentImg} alt="" />
                    ) : (
                      <span className="v-thumb" style={{ background: current ? gradFor(current.id) : "rgba(255,255,255,.12)" }} aria-hidden="true">
                        {current ? String(items.indexOf(current) + 1).padStart(2, "0") : "…"}
                      </span>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="v-pin">
                        {current ? (auction ? "Budsalg" : "Vises nu") : "Om lidt"}
                        {current && ((current as { auth_status?: string }).auth_status === "approved" || props.authOk?.includes(current.id)) ? (
                          <span className="v-auth" title="Ægthed tjekket af Relived">
                            <IconShieldCheck />
                            Ægthed tjekket
                          </span>
                        ) : null}
                      </div>
                      <div className="v-name">{current ? current.name : "Sælgeren finder næste ting frem"}</div>
                      {current && ownerOf(current) ? <div className="v-owner">Sælges af @{ownerOf(current)}</div> : null}
                      <div className="v-meta" aria-live="polite">
                        {auction
                          ? auction.high_bid
                            ? `${auction.status === "sold" ? "Solgt for" : "Højeste bud"} ${kr(auction.high_bid)} · ${auction.high_handle}`
                            : `Start ${kr(auction.price)}`
                          : current
                            ? itemMeta(current) || kr(current.price)
                            : "Hold øje med chatten"}
                      </div>
                    </div>
                    {current ? (
                      <button className="v-buy" type="button" onClick={auction ? bid : snup} disabled={buyDisabled}>
                        {buyLabel}
                      </button>
                    ) : null}
                  </div>
                  {video ? (
                    <Reactions room={room} role="viewer" hostIdentity={`seller:${props.seller.id}`} loggedIn={Boolean(me)} loginHref={loginHref} />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          {pushAsk ? (
            <div className="show-push">
              <PushOffer handle={handle} />
            </div>
          ) : null}
          {live ? (
            <p className="fine" style={{ textAlign: "center" }}>
              {auction
                ? "Dit bud er bindende. Vinder du, lander tingen under Mine køb, og du betaler inden 3 dage."
                : "Når du køber, vises dit brugernavn i chatten. Du betaler samlet under Mine køb inden 3 dage."}
            </p>
          ) : null}
        </div>

        <aside className="show-side" aria-label="Chat">
          <Chat showId={show.id} messages={messages} me={me} live={live} loginHref={loginHref} canModerate={Boolean(me && me.id === show.seller_id)} />
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn btn-line btn-block" href="/kurv">Mine køb</Link>
            <button className="icon-btn" type="button" onClick={share} aria-label="Del showet">
              <IconShare stroke="currentColor" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
