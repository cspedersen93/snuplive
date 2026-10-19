"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Chat from "@/components/Chat";
import { IconBulb } from "@/components/Icons";
import { StudioVideo } from "@/components/LiveVideo";
import { ScreenTop, itemMeta } from "@/components/Screen";
import { useShowRealtime, sortItems } from "@/components/useShowRealtime";
import { category, gradFor, kr, when } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import { ITEM_COLS, type Item, type Message, type Profile, type Show } from "@/lib/types";

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

  const live = show.status === "live";
  const ended = show.status === "ended";
  const current = items.find((i) => i.id === show.current_item_id) ?? null;
  const sold = items.filter((i) => i.status === "sold");
  const revenue = sold.reduce((a, i) => a + i.price, 0);
  const queued = items.filter((i) => i.status === "queued");
  const next = queued[0] ?? items.find((i) => i.status === "unsold" && i.id !== current?.id) ?? null;
  const shareUrl = `/live/${props.profile.handle}`;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), current?.rush_ends_at ? 250 : 1000);
    return () => clearInterval(t);
  }, [current?.rush_ends_at]);

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

  // Hent salg igen, når der bliver snuppet noget.
  const soldKey = sold.map((i) => i.id).join(",");
  useEffect(() => {
    if (!soldKey) return;
    sb.from("sales")
      .select(SALE_SELECT)
      .eq("show_id", show.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => data && setSales(data as unknown as StudioSale[]));
  }, [soldKey, show.id, sb]);

  // Advar, hvis sælgeren lukker fanen midt i et show.
  useEffect(() => {
    if (!live) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [live]);

  const onVideoError = useCallback((e: Error) => setVideoErr(e.message || "Forbindelsen til videoen blev afbrudt."), []);
  const onDeviceError = useCallback((text: string) => setVideoErr(text), []);

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
      void rpc("set_show_status", { p_show: show.id, p_status: "live" }, "Du er live!");
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
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [cond, setCond] = useState("");
  const [price, setPrice] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const p = Number(price.replace(/[^\d]/g, ""));
    if (n.length < 2) return setFormErr("Skriv hvad tingen er, fx \"Uldfrakke, kamel\".");
    if (!Number.isInteger(p) || p < 1 || p > 100000) return setFormErr("Skriv en pris i hele kroner mellem 1 og 100.000.");
    setFormErr(null);
    setBusy(true);
    const position = items.reduce((m, i) => Math.max(m, i.position), 0) + 1;
    const { data, error } = await sb
      .from("items")
      .insert({ show_id: show.id, seller_id: me.id, name: n, size: size.trim() || null, condition: cond.trim() || null, price: p, position })
      .select(ITEM_COLS)
      .single();
    setBusy(false);
    if (error || !data) return setFormErr(errorText(error));
    setItems((xs) => (xs.some((x) => x.id === (data as Item).id) ? xs : sortItems([...xs, data as Item])));
    setName("");
    setSize("");
    setCond("");
    setPrice("");
    document.getElementById("ni-name")?.focus();
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
      toast(`Dit link: snuplive.dk${shareUrl}`);
    }
  }

  const rushLeft = current?.rush_ends_at
    ? Math.max(0, Math.ceil((Date.parse(current.rush_ends_at) - (now + offset)) / 1000))
    : null;
  const saleFor = (itemId: string) => sales.find((s) => s.item_id === itemId);
  const cover = category(show.category).cover;
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
                    <li key={it.id} className={`lot${it.id === current?.id ? " is-now" : ""}`}>
                      <span className="lot-n" style={{ background: gradFor(it.id) }} aria-hidden="true">{String(n + 1).padStart(2, "0")}</span>
                      <div style={{ minWidth: 0 }}>
                        <strong>{it.name}</strong>
                        <span>
                          {kr(it.price)}
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
                          <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => rpc("present_item", { p_item: it.id })}>Vis</button>
                        ) : (
                          <span className="chip">{it.status === "unsold" ? "Ikke solgt" : "I køen"}</span>
                        )}
                        {canRemove ? (
                          <button className="linkbtn" type="button" onClick={() => removeItem(it.id)} aria-label={`Fjern ${it.name}`}>Fjern</button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: ".9rem" }}>Læg de ting ind, du vil vise frem. Du behøver ikke billeder.</p>
            )}
          </div>
          {!ended ? (
            <form className="box" onSubmit={addItem} noValidate style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2>Læg en ting i køen</h2>
              <div className="field">
                <label htmlFor="ni-name">Hvad er det?</label>
                <input id="ni-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Fx Uldfrakke, kamel" />
              </div>
              <div className="fgrid" style={{ marginTop: 0 }}>
                <div className="field">
                  <label htmlFor="ni-size">Str.</label>
                  <input id="ni-size" value={size} onChange={(e) => setSize(e.target.value)} maxLength={20} placeholder="M" />
                </div>
                <div className="field">
                  <label htmlFor="ni-price">Pris (kr)</label>
                  <input id="ni-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="150" />
                </div>
                <div className="field full">
                  <label htmlFor="ni-cond">Stand</label>
                  <input id="ni-cond" value={cond} onChange={(e) => setCond(e.target.value)} maxLength={40} placeholder="Fx Som ny" />
                </div>
              </div>
              {formErr ? <p className="err" role="alert">{formErr}</p> : null}
              <button className="btn btn-ghost btn-block" type="submit" disabled={busy}>Læg i køen</button>
            </form>
          ) : null}
          <div className="box ship-note">
            <IconBulb />
            <span>Vis mærket og målene tæt på kameraet, og svar på spørgsmålene højt. Det giver flere snup.</span>
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
                <StudioVideo token={video.token} url={video.url} onViewers={setViewers} onError={onVideoError} onDeviceError={onDeviceError} onCamera={setCameraReady} />
              ) : live ? (
                <div className="screen-dark" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="feed" src={cover} alt="" />
              )}
              <div className="shade" />
              <ScreenTop handle={props.profile.handle} area={props.profile.area} live={live} viewers={viewers} />

              {!live && !ended ? (
                <div className="pre-live">
                  {count !== null ? (
                    <div className="count" aria-live="assertive">{count}</div>
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
                  <span>Dine seere kan ikke se dig lige nu.</span>
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
                    <div className="v-flag">Solgt{saleFor(current.id)?.buyer ? ` til @${saleFor(current.id)?.buyer?.handle}` : ""}!</div>
                  ) : null}
                  {current && current.status !== "sold" && rushLeft !== null ? (
                    <div className="v-rush" role="timer">{rushLeft > 0 ? <>Lynrunde <span>{rushLeft}</span></> : "Lynrunden er slut"}</div>
                  ) : null}
                  <div className="v-card">
                    <span className="v-thumb" style={{ background: current ? gradFor(current.id) : "rgba(255,255,255,.12)" }} aria-hidden="true">
                      {current ? String(items.indexOf(current) + 1).padStart(2, "0") : "…"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="v-pin">{current ? "Vises nu" : "Ingen ting vises"}</div>
                      <div className="v-name">{current ? current.name : next ? `Næste: ${next.name}` : "Køen er tom"}</div>
                      <div className="v-meta">{current ? itemMeta(current) || " " : "Tryk Vis næste"}</div>
                    </div>
                    {current ? <span className="v-buy" aria-hidden="true">{kr(current.price)}</span> : null}
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
                <button className="btn btn-ghost" type="button" disabled={!live || busy || !next} onClick={() => next && rpc("present_item", { p_item: next.id })}>
                  Vis næste
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={!live || busy || !current || current.status === "sold" || (rushLeft ?? 0) > 0}
                  onClick={() => current && rpc("start_rush", { p_item: current.id, p_seconds: 10 })}
                >
                  Lynrunde 10 s
                </button>
              </div>
              <button className="btn btn-line btn-block" type="button" disabled={!live || busy} onClick={() => setConfirmEnd(true)}>
                Afslut show
              </button>
            </div>
          </div>
          {!live && !ended ? (
            <p className="fine" style={{ textAlign: "center", marginTop: 10 }}>
              Planlagte shows kan slettes.{" "}
              <button className="linkbtn" type="button" onClick={deleteShow} disabled={busy}>Slet showet</button>
            </p>
          ) : null}
        </div>

        <aside className="show-side" aria-label="Styring og chat">
          <Chat showId={show.id} messages={messages} me={me} live={live} loginHref="/login" hint="Seerne skriver her" />
        </aside>
      </div>

      {confirmEnd ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="m-end">
          <div className="modal-card">
            <span className="label red">Afslut show</span>
            <h2 className="h2" id="m-end" style={{ fontSize: "2rem" }}>Vil du afslutte showet?</h2>
            <p className="muted">Videoen stopper for alle seere. Ting, der ikke er solgt, bliver markeret som ikke solgt.</p>
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
                ? `${items.length - sold.length} ting blev ikke solgt. Læg dem i dit næste show.`
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
