"use client";

import { useEffect, useRef, useState } from "react";
import { IconSparkle } from "@/components/Icons";
import { suggestedPrice, type AiListing } from "@/lib/aiListing";
import { askAiListing, checkText } from "@/lib/aiListingClient";
import { blobToBase64 } from "@/lib/bestPhoto";
import { NEW_ONLY_CATEGORIES, NEW_ONLY_CONDITION, pickCategories } from "@/lib/format";
import { PILE_MAX_ITEMS, PILE_MAX_SECONDS, pileShots, pileTimes, type PileSegment } from "@/lib/pile";
import { frameFromVideo } from "@/lib/resizeImage";
import { pingSearchAlerts } from "@/lib/searchPing";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import { ITEM_COLS, type Item } from "@/lib/types";

interface Props {
  sellerId: string;
  showId: string;
  showCategory: string;
  nextPosition: number;
  hideCats?: readonly string[];
  parcelReady?: boolean;
  pickupReady?: boolean;
  onSaved: (item: Item) => void;
}

interface Draft {
  key: string;
  photos: { blob: Blob; url: string }[];
  name: string;
  price: string;
  suggested: number | null;
  size: string;
  condition: string;
  category: string;
  description: string;
  unsure: string[];
  /** Tages varen med, når bunken lægges i køen? */
  on: boolean;
  /** Bekræftet nyt og uåbnet (kun kategorier, hvor det kræves). */
  newOk: boolean;
  /** AI'en kunne ikke skrive et forslag: sælgeren udfylder selv. */
  blank: boolean;
  saved: boolean;
  error: string | null;
}

type Phase = "idle" | "frames" | "split" | "write" | "review" | "saving";

const WHY: Record<string, string> = {
  off: "AI er ikke slået til endnu, så bunken kan ikke deles op. Læg varerne ind én ad gangen.",
  error: "AI'en svarede ikke. Prøv igen om lidt.",
  unclear: "AI'en kunne ikke dele videoen op. Prøv igen med en video, hvor du viser én vare ad gangen.",
};

/** Venter, til videoen står på tidspunktet t. */
function seek(video: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      video.removeEventListener("seeked", done);
      reject(new Error("Videoen kunne ikke læses. Prøv en anden video."));
    }, 8000);
    function done() {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    }
    video.addEventListener("seeked", done);
    video.currentTime = t;
  });
}

/**
 * "Film bunken": sælgeren filmer sine varer i ét stræk, og AI'en laver et forslag til en annonce pr. vare.
 * Intet bliver lagt i køen af sig selv: sælgeren ser hver vare igennem, sætter prisen og trykker selv "Læg i køen".
 * Videoen forlader ikke telefonen. Kun små stillbilleder sendes til AI'en.
 */
export default function PileFilm({ sellerId, showId, showCategory, nextPosition, hideCats = [], parcelReady = false, pickupReady = false, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const cancelled = useRef(false);
  const urls = useRef<string[]>([]);
  const cats = pickCategories(hideCats);

  useEffect(
    () => () => {
      cancelled.current = true;
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  function reset() {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setDrafts([]);
    setErr(null);
    setProgress("");
    setPhase("idle");
  }

  async function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    cancelled.current = false;
    const src = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    try {
      setPhase("frames");
      setProgress("Åbner videoen …");
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("Videoen kunne ikke åbnes på denne enhed. Prøv at filme direkte med knappen Film nu."));
        video.src = src;
      });
      if (!Number.isFinite(video.duration) || video.duration < 4) throw new Error("Videoen er for kort. Film mindst et par varer.");
      if (video.duration > PILE_MAX_SECONDS + 5) throw new Error(`Videoen må højst være ${PILE_MAX_SECONDS / 60} minutter. Del bunken i flere videoer.`);

      // 1) Små stillbilleder til opdelingen.
      const times = pileTimes(video.duration);
      const small: string[] = [];
      for (let i = 0; i < times.length; i++) {
        if (cancelled.current) return;
        setProgress(`Ser videoen igennem … ${Math.round(((i + 1) / times.length) * 100)} %`);
        await seek(video, times[i]);
        const b = await frameFromVideo(video, 256, 320, 0.6);
        if (b) small.push(await blobToBase64(b));
        else small.push("");
      }
      const usable = small.map((s, i) => ({ s, i })).filter((x) => x.s);
      if (usable.length < 2) throw new Error("Videoen kunne ikke læses. Prøv en anden video.");

      // 2) AI'en deler billederne i varer.
      setPhase("split");
      setProgress("Finder varerne i videoen …");
      const step = times.length > 1 ? times[1] - times[0] : 1.5;
      const r = await fetch("/api/studio/pile-split", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: usable.map((x) => x.s), step }),
      });
      const j = (await r.json().catch(() => null)) as { items?: PileSegment[] | null; why?: string; error?: string } | null;
      if (!r.ok) throw new Error(j?.error || WHY.error);
      if (!j?.items) throw new Error(WHY[j?.why ?? "error"] ?? WHY.error);
      const segs = j.items.slice(0, PILE_MAX_ITEMS);
      if (!segs.length) throw new Error("AI'en kunne ikke se nogen varer i videoen. Hold hver vare frem foran kameraet i mindst fem sekunder.");

      // 3) Store billeder og et forslag til annoncen for hver vare.
      setPhase("write");
      const made: Draft[] = [];
      for (let n = 0; n < segs.length; n++) {
        if (cancelled.current) return;
        setProgress(`Skriver annonce ${n + 1} af ${segs.length} …`);
        const photos: Draft["photos"] = [];
        for (const idx of pileShots(segs[n])) {
          const t = times[usable[idx]?.i ?? -1];
          if (t === undefined) continue;
          await seek(video, t);
          const big = await frameFromVideo(video, 1080, 1350, 0.85);
          if (big) {
            const url = URL.createObjectURL(big);
            urls.current.push(url);
            photos.push({ blob: big, url });
          }
        }
        if (!photos.length) continue;
        const ai = await askAiListing(photos.map((p) => p.blob));
        const l: AiListing | null = "listing" in ai ? ai.listing : null;
        const cat = l?.category && cats.some((c) => c.key === l.category) ? l.category : showCategory;
        made.push({
          key: `${Date.now().toString(36)}-${n}`,
          photos,
          name: l?.name ?? "",
          price: "",
          suggested: l ? suggestedPrice(l) : null,
          size: l?.size ?? "",
          condition: l?.condition ?? "",
          category: cat,
          description: l?.description ?? "",
          unsure: l?.unsure ?? [],
          on: true,
          newOk: false,
          blank: !l,
          saved: false,
          error: null,
        });
        setDrafts([...made]);
      }
      if (!made.length) throw new Error("Der kom ingen brugbare billeder ud af videoen. Prøv igen med bedre lys.");
      setPhase("review");
      setProgress("");
    } catch (e2) {
      if (cancelled.current) return;
      setErr(errorText(e2, "Noget gik galt. Prøv igen."));
      setPhase("idle");
    } finally {
      URL.revokeObjectURL(src);
      video.removeAttribute("src");
      video.load();
    }
  }

  const patch = (key: string, p: Partial<Draft>) => setDrafts((cur) => cur.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const priceOf = (d: Draft) => Number(d.price.replace(/[^\d]/g, ""));
  const ready = (d: Draft) =>
    d.name.trim().length >= 2 && Number.isInteger(priceOf(d)) && priceOf(d) >= 1 && priceOf(d) <= 100000 && (!NEW_ONLY_CATEGORIES.includes(d.category) || d.newOk);
  const todo = drafts.filter((d) => d.on && !d.saved);
  const canSave = todo.length > 0 && todo.every(ready);

  async function saveAll() {
    if (!canSave) return;
    setPhase("saving");
    setErr(null);
    const sb = getSupabase();
    let pos = nextPosition;
    let ok = 0;
    for (const d of todo) {
      setProgress(`Lægger vare ${ok + 1} af ${todo.length} i køen …`);
      try {
        const id = crypto.randomUUID();
        const paths: string[] = [];
        for (const ph of d.photos) {
          const path = `${sellerId}/${id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`;
          const up = await sb.storage.from("items").upload(path, ph.blob, { contentType: "image/jpeg", cacheControl: "31536000" });
          if (up.error) throw up.error;
          paths.push(path);
        }
        const newOnly = NEW_ONLY_CATEGORIES.includes(d.category);
        const { data, error } = await sb
          .from("items")
          .insert({
            id,
            show_id: showId,
            seller_id: sellerId,
            position: pos,
            name: d.name.trim(),
            size: d.size.trim() || null,
            condition: newOnly ? NEW_ONLY_CONDITION : d.condition.trim() || null,
            price: priceOf(d),
            sale_type: "fixed",
            category: d.category === showCategory ? null : d.category,
            description: d.description.trim() || null,
            images: paths,
            ...(parcelReady ? { package_size: null } : {}),
            ...(pickupReady ? { pickup_only: false } : {}),
          })
          .select(ITEM_COLS)
          .single();
        if (error || !data) throw error ?? new Error("Varen kunne ikke gemmes.");
        onSaved(data as Item);
        patch(d.key, { saved: true, error: null });
        pos += 1;
        ok += 1;
      } catch (e2) {
        patch(d.key, { error: errorText(e2, "Varen kunne ikke gemmes.") });
      }
    }
    if (ok) pingSearchAlerts();
    setProgress("");
    if (ok === todo.length) {
      toast(`${ok} ${ok === 1 ? "vare er" : "varer er"} lagt i køen`);
      reset();
      setOpen(false);
    } else {
      setErr(`${ok} af ${todo.length} varer blev lagt i køen. Ret dem, der mangler, og prøv igen.`);
      setPhase("review");
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-line pile-open" onClick={() => setOpen(true)}>
        <IconSparkle className="ico" />
        Film bunken: læg mange varer ind på én gang
      </button>
    );
  }

  const working = phase === "frames" || phase === "split" || phase === "write";
  return (
    <section className="pile" aria-labelledby="h-pile">
      <div className="pile-head">
        <h3 className="h3" id="h-pile">Film bunken</h3>
        <button
          type="button"
          className="linkbtn"
          onClick={() => {
            cancelled.current = true;
            reset();
            setOpen(false);
          }}
        >
          Luk
        </button>
      </div>

      {phase === "idle" ? (
        <>
          <ol className="pile-how">
            <li>Læg varerne i en bunke, og find godt lys.</li>
            <li>Film én vare ad gangen. Hold den frem i mindst fem sekunder, og vend den gerne.</li>
            <li>Læg den væk, før du tager den næste. Videoen må højst vare {PILE_MAX_SECONDS / 60} minutter.</li>
          </ol>
          <div className="pile-pick">
            <input id="pile-cam" className="file-input" type="file" accept="video/*" capture="environment" onChange={onVideo} />
            <label className="btn btn-ivory" htmlFor="pile-cam">Film nu</label>
            <input id="pile-file" className="file-input" type="file" accept="video/*" onChange={onVideo} />
            <label className="btn btn-line" htmlFor="pile-file">Vælg en video</label>
          </div>
          <p className="fine">Videoen bliver på din telefon. Kun små stillbilleder sendes til AI'en, som laver et forslag til hver vare. Du godkender alt, før det lægges i køen.</p>
        </>
      ) : null}

      {working || phase === "saving" ? (
        <p className="pile-busy" role="status">
          <span className="pile-spin" aria-hidden="true" />
          {progress}
        </p>
      ) : null}
      {err ? <p className="err" role="alert">{err}</p> : null}

      {drafts.length ? (
        <>
          {phase === "review" ? (
            <p className="pile-sum">
              AI'en fandt <b>{drafts.length} {drafts.length === 1 ? "vare" : "varer"}</b>. Se dem igennem, og sæt en pris på hver. Fjern fluebenet ved dem, du ikke vil have med.
            </p>
          ) : null}
          <ul className="pile-list">
            {drafts.map((d, i) => {
              const newOnly = NEW_ONLY_CATEGORIES.includes(d.category);
              return (
                <li key={d.key} className={`pile-item${d.on ? "" : " off"}${d.saved ? " saved" : ""}`}>
                  <div className="pile-photos">
                    {d.photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.url} src={p.url} alt="" />
                    ))}
                  </div>
                  <div className="pile-fields">
                    <label className="pile-on">
                      <input type="checkbox" checked={d.on} disabled={d.saved || phase !== "review"} onChange={(e) => patch(d.key, { on: e.target.checked })} />
                      {d.saved ? "Lagt i køen" : `Tag vare ${i + 1} med`}
                    </label>
                    {d.on && !d.saved ? (
                      <>
                        {d.blank ? <p className="fine">AI'en kunne ikke skrive et forslag til denne. Udfyld selv, eller tag den ud.</p> : null}
                        <div className="field">
                          <label htmlFor={`pn-${d.key}`}>Hvad er det?</label>
                          <input id={`pn-${d.key}`} value={d.name} maxLength={80} onChange={(e) => patch(d.key, { name: e.target.value })} />
                        </div>
                        <div className="pile-row">
                          <div className="field">
                            <label htmlFor={`pp-${d.key}`}>Pris (kr)</label>
                            <input id={`pp-${d.key}`} inputMode="numeric" value={d.price} placeholder={d.suggested ? `fx ${d.suggested}` : ""} onChange={(e) => patch(d.key, { price: e.target.value })} />
                          </div>
                          {d.suggested && !d.price ? (
                            <button type="button" className="btn btn-line btn-sm" onClick={() => patch(d.key, { price: String(d.suggested) })}>Brug {d.suggested} kr</button>
                          ) : null}
                        </div>
                        <div className="pile-row">
                          <div className="field">
                            <label htmlFor={`pc-${d.key}`}>Kategori</label>
                            <select id={`pc-${d.key}`} value={d.category} onChange={(e) => patch(d.key, { category: e.target.value, newOk: false })}>
                              {cats.map((c) => (
                                <option key={c.key} value={c.key}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor={`ps-${d.key}`}>Str. eller mål</label>
                            <input id={`ps-${d.key}`} value={d.size} maxLength={40} onChange={(e) => patch(d.key, { size: e.target.value })} />
                          </div>
                        </div>
                        {newOnly ? (
                          <label className="pile-on">
                            <input type="checkbox" checked={d.newOk} onChange={(e) => patch(d.key, { newOk: e.target.checked })} />
                            Produktet er nyt og uåbnet
                          </label>
                        ) : (
                          <div className="field">
                            <label htmlFor={`pd-${d.key}`}>Stand</label>
                            <input id={`pd-${d.key}`} value={d.condition} maxLength={40} onChange={(e) => patch(d.key, { condition: e.target.value })} />
                          </div>
                        )}
                        <div className="field">
                          <label htmlFor={`pt-${d.key}`}>Beskrivelse</label>
                          <textarea id={`pt-${d.key}`} rows={3} value={d.description} maxLength={900} onChange={(e) => patch(d.key, { description: e.target.value })} />
                        </div>
                        {!d.blank ? <p className="fine">Forslag fra AI. {checkText(d.unsure)}</p> : null}
                        {d.error ? <p className="err" role="alert">{d.error}</p> : null}
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {phase === "review" ? (
            <div className="pile-foot">
              <button type="button" className="btn btn-red" disabled={!canSave} onClick={saveAll}>
                {todo.length ? `Læg ${todo.length} ${todo.length === 1 ? "vare" : "varer"} i køen` : "Vælg mindst én vare"}
              </button>
              {!canSave && todo.length ? <span className="fine">Sæt en pris på alle de varer, du vil have med.</span> : null}
              <button type="button" className="linkbtn" onClick={reset}>Start forfra</button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
