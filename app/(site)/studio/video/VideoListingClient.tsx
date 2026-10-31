"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconCamera, IconPlay } from "@/components/Icons";
import { blobToBase64 } from "@/lib/bestPhoto";
import type { Clip } from "@/lib/clipRecorder";
import { CATEGORIES, NEW_ONLY_CATEGORIES, NEW_ONLY_CONDITION } from "@/lib/format";
import { itemHref } from "@/lib/items";
import { needsAuth } from "@/lib/luxury";
import { resizeImage } from "@/lib/resizeImage";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import {
  FRAME_CHOICES,
  MAX_PHOTOS,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_S,
  VIDEO_MIN_S,
  canRecord,
  convertVideo,
  localPicks,
  openBackCamera,
  prepareVideo,
  recordFromCamera,
  releasePrepared,
  spreadFrames,
  type Frame,
  type PreparedVideo,
} from "@/lib/videoListing";
import AuthPanel from "../[id]/AuthPanel";

type Step = "start" | "camera" | "picked" | "converting" | "edit" | "done";
type Own = { file: File; url: string };
type Done = { id: string; name: string; authRequired: boolean };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const rand = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Sælg med video: film tingen (eller vælg en video), vælg billeder, udfyld annoncen og sæt den til salg. */
export default function VideoListingClient({ sellerId }: { sellerId: string }) {
  const [step, setStep] = useState<Step>("start");
  const [err, setErr] = useState<string | null>(null);

  // Kamera og optagelse
  const camRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<AbortController | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Valgt video
  const prepRef = useRef<PreparedVideo | null>(null);
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);
  const [pickedSeconds, setPickedSeconds] = useState(0);
  const [progress, setProgress] = useState(0);

  // Resultatet
  const [clip, setClip] = useState<Clip | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [own, setOwn] = useState<Own[]>([]);
  const [ai, setAi] = useState<"idle" | "busy" | "claude" | "local">("idle");

  // Annoncen
  const [name, setName] = useState("");
  const [cat, setCat] = useState("");
  const [size, setSize] = useState("");
  const [cond, setCond] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [newOk, setNewOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [authOpen, setAuthOpen] = useState(true);
  const [authSent, setAuthSent] = useState(false);
  const ownRef = useRef<HTMLInputElement>(null);
  /** Har sælgeren selv valgt billeder? Så overskriver Claudes valg ikke sælgerens. */
  const touched = useRef(false);

  const newOnly = NEW_ONLY_CATEGORIES.includes(cat);
  const authNeeded = needsAuth({ name, description: desc, category: cat, price: Number(price.replace(/[^\d]/g, "")) || 0 });
  const photoCount = selected.length + own.length;

  // Ryd op, når siden forlades.
  const framesRef = useRef<Frame[]>([]);
  framesRef.current = frames;
  const urlsRef = useRef<string[]>([]);
  useEffect(
    () => () => {
      stopRef.current?.abort();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      releasePrepared(prepRef.current);
      framesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  // Tiden, mens der filmes.
  useEffect(() => {
    if (!recording) return;
    const t0 = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 250);
    return () => clearInterval(id);
  }, [recording]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (camRef.current) camRef.current.srcObject = null;
  }

  function resetResult() {
    frames.forEach((f) => URL.revokeObjectURL(f.url));
    own.forEach((o) => URL.revokeObjectURL(o.url));
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    setFrames([]);
    setSelected([]);
    setOwn([]);
    setClip(null);
    setClipUrl(null);
    setAi("idle");
  }

  async function startCamera() {
    setErr(null);
    if (!canRecord()) return setErr("Din browser kan ikke filme her. Prøv i Safari eller Chrome på din telefon, eller vælg en video, du har filmet.");
    try {
      const s = await openBackCamera();
      streamRef.current = s;
      setStep("camera");
      // Videoen sættes på, når kameravisningen er på siden.
      requestAnimationFrame(() => {
        if (camRef.current) {
          camRef.current.srcObject = s;
          void camRef.current.play().catch(() => {});
          // På telefonen skal hele kameraet og knappen kunne ses.
          camRef.current.closest(".vl-cam")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      setErr(
        denied
          ? "Relived må ikke bruge kameraet. Giv lov i browserens indstillinger (ved adresselinjen), og prøv igen."
          : "Kameraet kunne ikke starte. Luk andre apps, der bruger kameraet, og prøv igen.",
      );
    }
  }

  async function record() {
    const s = streamRef.current;
    const v = camRef.current;
    if (!s || !v) return;
    const stop = new AbortController();
    stopRef.current = stop;
    setRecording(true);
    const t0 = Date.now();
    const { clip: c, frames: fr } = await recordFromCamera(s, v, stop.signal);
    setRecording(false);
    stopRef.current = null;
    if (!c || Date.now() - t0 < VIDEO_MIN_S * 1000 - 300) {
      fr.forEach((f) => URL.revokeObjectURL(f.url));
      return setErr(c ? `Film mindst ${VIDEO_MIN_S} sekunder.` : "Optagelsen virkede ikke. Prøv igen.");
    }
    stopCamera();
    finish(c, fr);
  }

  function stopRecording() {
    stopRef.current?.abort();
  }

  function cancelCamera() {
    stopRef.current?.abort();
    stopCamera();
    setRecording(false);
    setStep("start");
  }

  async function pickFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setErr(null);
    releasePrepared(prepRef.current);
    prepRef.current = null;
    try {
      const p = await prepareVideo(f);
      prepRef.current = p;
      setPickedUrl(p.url);
      setPickedSeconds(p.seconds);
      setStep("picked");
    } catch (e) {
      setErr(errorText(e));
    }
  }

  function takeFile() {
    const p = prepRef.current;
    if (!p) return;
    setErr(null);
    setProgress(0);
    setStep("converting");
    const stop = new AbortController();
    stopRef.current = stop;
    // Skal kaldes direkte fra trykket (afspilning og lyd kræver det).
    convertVideo(p, setProgress, stop.signal)
      .then(({ clip: c, frames: fr }) => {
        stopRef.current = null;
        releasePrepared(prepRef.current);
        prepRef.current = null;
        setPickedUrl(null);
        if (!c) {
          fr.forEach((f) => URL.revokeObjectURL(f.url));
          if (!stop.signal.aborted) setErr("Videoen kunne ikke gøres klar. Prøv igen, eller film varen direkte her.");
          setStep("start");
          return;
        }
        finish(c, fr);
      })
      .catch((e) => {
        stopRef.current = null;
        releasePrepared(prepRef.current);
        prepRef.current = null;
        setPickedUrl(null);
        setErr(errorText(e));
        setStep("start");
      });
  }

  function cancelConvert() {
    stopRef.current?.abort();
  }

  function finish(c: Clip, fr: Frame[]) {
    if (c.blob.size > VIDEO_MAX_BYTES) {
      fr.forEach((f) => URL.revokeObjectURL(f.url));
      setErr("Videoen fylder for meget. Film en kortere video.");
      setStep("start");
      return;
    }
    const url = URL.createObjectURL(c.blob);
    const kept = spreadFrames(fr, FRAME_CHOICES);
    setClip(c);
    setClipUrl(url);
    setFrames(kept);
    setSelected(localPicks(kept, MAX_PHOTOS));
    setStep("edit");
    if (kept.length) void askClaude(kept);
  }

  async function askClaude(kept: Frame[]) {
    setAi("busy");
    try {
      const images = await Promise.all(kept.map((f) => blobToBase64(f.small)));
      const r = await fetch("/api/studio/photo-pick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "video", images }),
      });
      const j = (await r.json().catch(() => null)) as { picks?: number[] | null } | null;
      const picks = (j?.picks ?? []).map((n) => n - 1).filter((i) => i >= 0 && i < kept.length);
      if (r.ok && picks.length) {
        // Sælgeren kan have valgt selv i mellemtiden. Så bestemmer sælgeren.
        setSelected((cur) => (touched.current ? cur : picks.slice(0, MAX_PHOTOS)));
        setAi("claude");
      } else setAi("local");
    } catch {
      setAi("local");
    }
  }

  function toggle(i: number) {
    touched.current = true;
    setSelected((cur) => {
      if (cur.includes(i)) return cur.filter((x) => x !== i);
      if (cur.length + own.length >= MAX_PHOTOS) {
        toast(`Du kan vælge ${MAX_PHOTOS} billeder. Tryk på et valgt billede for at fjerne det.`);
        return cur;
      }
      return [...cur, i];
    });
  }

  function addOwn(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photoCount;
    if (room <= 0) return toast(`Du kan vælge ${MAX_PHOTOS} billeder. Fjern et af de andre først.`);
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    setOwn((o) => [...o, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    if (ownRef.current) ownRef.current.value = "";
  }

  function removeOwn(i: number) {
    setOwn((o) => {
      if (o[i]) URL.revokeObjectURL(o[i].url);
      return o.filter((_, j) => j !== i);
    });
  }

  function again() {
    resetResult();
    touched.current = false;
    setErr(null);
    setStep("start");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!clip) return;
    const n = name.trim();
    const p = Number(price.replace(/[^\d]/g, ""));
    if (n.length < 2) return setErr('Skriv hvad varen er, fx "Strikkjole, grøn".');
    if (!cat) return setErr("Vælg en kategori.");
    if (!Number.isInteger(p) || p < 1 || p > 100000) return setErr("Skriv en pris i hele kroner mellem 1 og 100.000.");
    if (newOnly && !newOk) return setErr("Bekræft, at produktet er nyt og uåbnet. Brugt makeup og hudpleje må ikke sælges på Relived.");
    if (!photoCount) return setErr("Vælg mindst ét billede til annoncen.");
    setErr(null);
    setBusy(true);
    const sb = getSupabase();
    const id = crypto.randomUUID();
    const clipPath = `${sellerId}/${id}/clip-${rand()}.${clip.ext}`;
    const imgPaths: string[] = [];
    let clipUp = false;
    try {
      const up = await sb.storage.from("clips").upload(clipPath, clip.blob, { contentType: clip.blob.type || `video/${clip.ext}`, cacheControl: "31536000" });
      if (up.error) throw up.error;
      clipUp = true;
      const blobs: Blob[] = [...selected.map((i) => frames[i].full), ...(await Promise.all(own.map((o) => resizeImage(o.file, 1080, 1350))))];
      for (const b of blobs.slice(0, MAX_PHOTOS)) {
        const path = `${sellerId}/${id}/${rand()}.jpg`;
        const r = await sb.storage.from("items").upload(path, b, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (r.error) throw r.error;
        imgPaths.push(path);
      }
      const { data, error } = await sb.rpc("create_video_listing", {
        p_id: id,
        p_name: n,
        p_size: size.trim() || null,
        p_condition: newOnly ? NEW_ONLY_CONDITION : cond.trim() || null,
        p_price: p,
        p_category: cat,
        p_description: desc.trim() || null,
        p_images: imgPaths,
        p_clip: clipPath,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { id: string; name: string; auth_required?: boolean } | null;
      setDone({ id, name: row?.name ?? n, authRequired: Boolean(row?.auth_required) });
      setAuthOpen(true);
      setAuthSent(false);
      setStep("done");
      resetResult();
      setName("");
      setCat("");
      setSize("");
      setCond("");
      setPrice("");
      setDesc("");
      setNewOk(false);
      touched.current = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e2) {
      // Filerne, der nåede op, slettes igen (det gør ikke noget, hvis det fejler).
      if (clipUp) void sb.storage.from("clips").remove([clipPath]);
      if (imgPaths.length) void sb.storage.from("items").remove(imgPaths);
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  }

  // ── Visning ───────────────────────────────────────────────────────────────

  if (step === "done" && done) {
    const href = itemHref(done);
    return (
      <div className="vl">
        <div className="box vl-done" role="status">
          <h2 className="h3">Din annonce er til salg</h2>
          <p className="muted">
            &quot;{done.name}&quot; kan købes nu. Den kan ses under Til salg, i Klip og på din side. Du kan rette prisen eller tage
            den af salg under <Link href="/studio">Mine shows</Link> → Til salg.
          </p>
          {done.authRequired ? (
            <p className="notice auth-note" style={{ margin: "4px 0 0" }}>
              <span>
                <b>Ægthedstjek:</b> mærkevarer skal tjekkes af Relived, før de kan købes.{" "}
                {authSent ? "Tak, vi har fået billederne og giver besked på mail." : "Send nærbilleder af logo, koder og syninger nu."}
              </span>
            </p>
          ) : null}
          <div className="vl-row">
            <Link className="btn btn-red" href={href}>Se annoncen</Link>
            <button className="btn btn-line" type="button" onClick={() => { setDone(null); again(); }}>
              Lav en videoannonce til
            </button>
          </div>
        </div>
        {done.authRequired && !authSent && authOpen ? (
          <AuthPanel
            sellerId={sellerId}
            itemId={done.id}
            itemName={done.name}
            onSent={() => setAuthSent(true)}
            onClose={() => setAuthOpen(false)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="vl">
      {step === "start" ? (
        <div className="box vl-start">
          <div className="vl-intro">
            <h2 className="h3">Film varen, og sæt den til salg</h2>
            <p className="muted">
              Har du ikke lyst til at gå live? Film varen i op til {VIDEO_MAX_S} sekunder med telefonens kamera. Du skal ikke selv
              være med. Vi finder billederne i videoen, og køberne kan se varen i bevægelse.
            </p>
            <ul className="vl-tips">
              <li>Forside og bagside</li>
              <li>Mærke og størrelse tæt på</li>
              <li>Eventuelle fejl eller slid</li>
              <li>Godt lys, gerne ved et vindue</li>
            </ul>
          </div>
          <div className="vl-row">
            <button className="btn btn-red" type="button" onClick={startCamera}>
              <IconCamera width={18} height={18} /> Film nu
            </button>
            <label className="btn btn-line vl-file">
              <input className="file-input" type="file" accept="video/*" onChange={(e) => { void pickFile(e.target.files); e.target.value = ""; }} />
              <span>Vælg en video</span>
            </label>
          </div>
        </div>
      ) : null}

      {step === "camera" ? (
        <div className="vl-cam-wrap">
          <div className={`vl-cam${recording ? " rec" : ""}`}>
            <video ref={camRef} autoPlay muted playsInline aria-label="Kameraet" />
            <div className="vl-cam-top" aria-live="polite">
              {recording ? (
                <span className="vl-rec-time">
                  <span className="live-dot white" /> {fmt(elapsed)} / {fmt(VIDEO_MAX_S)}
                </span>
              ) : (
                <span>Vis varen forfra, bagfra og tæt på mærket</span>
              )}
            </div>
            {recording ? (
              <div className="vl-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (elapsed / VIDEO_MAX_S) * 100)}%` }} />
              </div>
            ) : null}
            <div className="vl-cam-bottom">
              {recording ? (
                <button
                  className="vl-shutter stop"
                  type="button"
                  onClick={stopRecording}
                  disabled={elapsed < VIDEO_MIN_S}
                  aria-label={elapsed < VIDEO_MIN_S ? `Film mindst ${VIDEO_MIN_S} sekunder` : "Stop optagelsen"}
                >
                  <span />
                </button>
              ) : (
                <button className="vl-shutter" type="button" onClick={record} aria-label="Start optagelsen">
                  <span />
                </button>
              )}
            </div>
          </div>
          <p className="fine vl-cam-hint">
            {recording
              ? elapsed < VIDEO_MIN_S
                ? `Film mindst ${VIDEO_MIN_S} sekunder.`
                : `Tryk på knappen, når du er færdig. Optagelsen stopper selv efter ${VIDEO_MAX_S} sekunder.`
              : "Tryk på den røde knap for at starte."}
          </p>
          {!recording ? (
            <button className="linkbtn" type="button" onClick={cancelCamera}>Fortryd</button>
          ) : null}
        </div>
      ) : null}

      {step === "picked" && pickedUrl ? (
        <div className="box vl-picked">
          <video className="vl-preview" src={pickedUrl} controls playsInline muted />
          <p className="muted">
            {pickedSeconds >= VIDEO_MAX_S - 0.5
              ? `Vi bruger højst de første ${VIDEO_MAX_S} sekunder.`
              : `Videoen er ${Math.round(pickedSeconds)} sekunder.`}{" "}
            Når du trykker <b>Brug videoen</b>, gør vi den klar, så den kan ses på alle telefoner. Det tager lige så lang tid som
            videoen. Hold siden åben imens.
          </p>
          <div className="vl-row">
            <button className="btn btn-red" type="button" onClick={takeFile}>Brug videoen</button>
            <button className="btn btn-line" type="button" onClick={() => { releasePrepared(prepRef.current); prepRef.current = null; setPickedUrl(null); setStep("start"); }}>
              Vælg en anden
            </button>
          </div>
        </div>
      ) : null}

      {step === "converting" ? (
        <div className="box vl-converting" role="status">
          <h2 className="h3">Gør videoen klar …</h2>
          <div className="vl-bar big" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="muted">{Math.round(progress * 100)} %. Hold siden åben, til den er færdig.</p>
          <button className="linkbtn" type="button" onClick={cancelConvert}>Fortryd</button>
        </div>
      ) : null}

      {step === "edit" && clip && clipUrl ? (
        <form className="vl-edit" onSubmit={save} noValidate>
          <div className="vl-media">
            <video className="vl-preview" src={clipUrl} controls playsInline loop />
            <button className="linkbtn" type="button" onClick={again}>Film igen</button>
          </div>

          <div className="vl-fields">
            <div className="box">
              <h2 className="h3" style={{ marginBottom: 4 }}>Billeder til annoncen</h2>
              <p className="fine" style={{ marginBottom: 10 }} aria-live="polite">
                {ai === "busy"
                  ? "Claude finder de bedste billeder i videoen …"
                  : ai === "claude"
                    ? `Claude har valgt de bedste billeder. Tryk for at vælge til eller fra (højst ${MAX_PHOTOS}). Nummer 1 er forsidebilledet.`
                    : `Vi har valgt de skarpeste billeder. Tryk for at vælge til eller fra (højst ${MAX_PHOTOS}). Nummer 1 er forsidebilledet.`}
              </p>
              <div className="vl-frames">
                {frames.map((f, i) => {
                  const n = selected.indexOf(i);
                  return (
                    <button
                      key={f.url}
                      type="button"
                      className={`vl-frame${n >= 0 ? " on" : ""}`}
                      aria-pressed={n >= 0}
                      aria-label={n >= 0 ? `Billede ${i + 1}, valgt som nummer ${n + 1}` : `Billede ${i + 1}`}
                      onClick={() => toggle(i)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt="" />
                      {n >= 0 ? <span className="vl-n">{n + 1}</span> : null}
                      {n === 0 ? <span className="vl-cover">Forside</span> : null}
                    </button>
                  );
                })}
                {own.map((o, i) => (
                  <div className="vl-frame on own" key={o.url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.url} alt="" />
                    <span className="vl-n">{selected.length + i + 1}</span>
                    <button type="button" className="pthumb-x" onClick={() => removeOwn(i)} aria-label={`Fjern dit billede ${i + 1}`}>×</button>
                  </div>
                ))}
                {photoCount < MAX_PHOTOS ? (
                  <label className="vl-frame add">
                    <input ref={ownRef} className="file-input" type="file" accept="image/*" multiple onChange={(e) => addOwn(e.target.files)} />
                    <span aria-hidden="true">+</span>
                    <span className="vl-add-t">Eget billede</span>
                  </label>
                ) : null}
              </div>
              {!frames.length ? <p className="fine">Der kom ingen billeder fra videoen. Læg et billede på selv.</p> : null}
            </div>

            <div className="box item-form">
              <div className="field">
                <label htmlFor="vl-name">Hvad er det?</label>
                <input id="vl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Fx Strikkjole, grøn" />
              </div>
              <div className="field">
                <label htmlFor="vl-cat">Kategori</label>
                <select id="vl-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="">Vælg kategori</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="fgrid" style={{ marginTop: 0 }}>
                <div className="field">
                  <label htmlFor="vl-size">Str.</label>
                  <input id="vl-size" value={size} onChange={(e) => setSize(e.target.value)} maxLength={20} placeholder="M" />
                </div>
                <div className="field">
                  <label htmlFor="vl-price">Pris (kr)</label>
                  <input id="vl-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="150" />
                </div>
                <div className="field full">
                  <label htmlFor="vl-cond">Stand</label>
                  {newOnly ? (
                    <input id="vl-cond" value={NEW_ONLY_CONDITION} readOnly aria-readonly="true" />
                  ) : (
                    <input id="vl-cond" value={cond} onChange={(e) => setCond(e.target.value)} maxLength={40} placeholder="Fx Som ny" />
                  )}
                </div>
              </div>
              {newOnly ? (
                <label className="check-line">
                  <input type="checkbox" checked={newOk} onChange={(e) => setNewOk(e.target.checked)} />
                  <span>Produktet er nyt og uåbnet (forseglingen er intakt). Brugt makeup og hudpleje må ikke sælges.</span>
                </label>
              ) : null}
              <div className="field">
                <label htmlFor="vl-desc">Beskrivelse (valgfri)</label>
                <textarea id="vl-desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} placeholder="Mærke, mål, materiale og eventuelle fejl" />
              </div>
              {authNeeded ? (
                <p className="notice auth-note" role="status">
                  <span>
                    <b>Ægthedstjek:</b> mærkevarer skal tjekkes af Relived, før de kan købes. Når annoncen er lagt op, sender du
                    nærbilleder af logo, koder og syninger.
                  </span>
                </p>
              ) : null}
              {err ? <p className="err" role="alert">{err}</p> : null}
              <button className="btn btn-red btn-block" type="submit" disabled={busy}>
                {busy ? "Lægger annoncen op …" : "Sæt til salg"}
              </button>
              <p className="fine">
                Annoncen kan købes med det samme til fast pris med Køb nu. Du kan rette prisen eller tage den af salg under Mine
                shows → Til salg.
              </p>
            </div>
          </div>
        </form>
      ) : null}

      {err && step !== "edit" ? <p className="err" role="alert">{err}</p> : null}
      {step === "start" ? (
        <p className="fine vl-foot">
          <IconPlay width={14} height={14} /> Videoen vises først på annoncen og i Klip, uden lyd, til køberen trykker på lyd.
        </p>
      ) : null}
    </div>
  );
}
