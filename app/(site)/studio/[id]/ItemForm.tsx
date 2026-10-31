"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, NEW_ONLY_CATEGORIES, NEW_ONLY_CONDITION } from "@/lib/format";
import { needsAuth } from "@/lib/luxury";
import { storageUrl } from "@/lib/images";
import { resizeImage } from "@/lib/resizeImage";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import { ITEM_COLS, type Item } from "@/lib/types";

const MAX_OWN = 4;
const MAX_ALL = 6;

interface Props {
  sellerId: string;
  showId: string;
  showCategory: string;
  /** Rediger en ting (ellers lægges en ny i køen). */
  item?: Item;
  nextPosition?: number;
  onSaved: (item: Item) => void;
  onCancel?: () => void;
}

type Photo = { kind: "old"; path: string } | { kind: "new"; file: File; url: string };

/** Formular til en ting i køen: navn, størrelse, pris, stand, kategori, beskrivelse og billeder. */
export default function ItemForm({ sellerId, showId, showCategory, item, nextPosition = 1, onSaved, onCancel }: Props) {
  const sb = getSupabase();
  const editing = Boolean(item);
  const [name, setName] = useState(item?.name ?? "");
  const [size, setSize] = useState(item?.size ?? "");
  const [cond, setCond] = useState(item?.condition ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [cat, setCat] = useState(item?.category ?? showCategory);
  const [saleType, setSaleType] = useState<"fixed" | "auction">(item?.sale_type ?? "fixed");
  const [desc, setDesc] = useState(item?.description ?? "");
  const [photos, setPhotos] = useState<Photo[]>(() => (item?.images ?? []).map((path) => ({ kind: "old", path })));
  const [more, setMore] = useState(Boolean(item?.description || item?.images?.length));
  const [newOk, setNewOk] = useState(item?.condition === NEW_ONLY_CONDITION);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = item?.id ?? "new";
  // Skønhed må kun sælges ny og uåbnet. Mærkevarer skal ægthedstjekkes, før de kan sælges.
  const newOnly = NEW_ONLY_CATEGORIES.includes(cat);
  const authNeeded = needsAuth({ name, description: desc, category: cat, price: Number(price.replace(/[^\d]/g, "")) || 0 });

  useEffect(
    () => () => photos.forEach((p) => p.kind === "new" && URL.revokeObjectURL(p.url)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const own = photos.filter((p) => p.kind === "new" || !p.path.includes("/live-")).length;
    const room = Math.min(MAX_OWN - own, MAX_ALL - photos.length);
    if (room <= 0) return toast(`Du kan lægge ${MAX_OWN} billeder på en vare.`);
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    setPhotos((ps) => [...ps, ...picked.map((file) => ({ kind: "new" as const, file, url: URL.createObjectURL(file) }))]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(i: number) {
    setPhotos((ps) => {
      const p = ps[i];
      if (p?.kind === "new") URL.revokeObjectURL(p.url);
      return ps.filter((_, j) => j !== i);
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const p = Number(price.replace(/[^\d]/g, ""));
    if (n.length < 2) return setErr('Skriv hvad varen er, fx "Uldfrakke, kamel".');
    if (!Number.isInteger(p) || p < 1 || p > 100000) return setErr("Skriv en pris i hele kroner mellem 1 og 100.000.");
    if (newOnly && !newOk) return setErr("Bekræft, at produktet er nyt og uåbnet. Brugt makeup og hudpleje må ikke sælges på Relived.");
    setErr(null);
    setBusy(true);
    try {
      const id = item?.id ?? crypto.randomUUID();
      // Nye billeder skæres til 4:5 og lægges i sælgerens mappe, før tingen gemmes.
      const paths: string[] = [];
      for (const ph of photos) {
        if (ph.kind === "old") {
          paths.push(ph.path);
          continue;
        }
        const jpeg = await resizeImage(ph.file, 1080, 1350);
        const path = `${sellerId}/${id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`;
        const up = await sb.storage.from("items").upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (up.error) throw up.error;
        paths.push(path);
      }
      const fields = {
        name: n,
        size: size.trim() || null,
        condition: newOnly ? NEW_ONLY_CONDITION : cond.trim() || null,
        price: p,
        sale_type: saleType,
        category: cat === showCategory ? null : cat,
        description: desc.trim() || null,
        images: paths,
      };
      const q = editing
        ? sb.from("items").update(fields).eq("id", id)
        : sb.from("items").insert({ id, show_id: showId, seller_id: sellerId, position: nextPosition, ...fields });
      const { data, error } = await q.select(ITEM_COLS).single();
      if (error || !data) throw error ?? new Error("Varen kunne ikke gemmes.");
      // Billeder, der er taget af, slettes (det gør ikke noget, hvis det fejler).
      const removed = (item?.images ?? []).filter((x) => !paths.includes(x));
      if (removed.length) void sb.storage.from("items").remove(removed);
      onSaved(data as Item);
      if (!editing) {
        setName("");
        setSize("");
        setCond("");
        setNewOk(false);
        setPrice("");
        setDesc("");
        setPhotos([]);
        document.getElementById("ni-name-new")?.focus();
      }
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={editing ? "item-form editing" : "box item-form"} onSubmit={save} noValidate>
      {editing ? null : <h2>Læg en vare i køen</h2>}
      <div className="field">
        <label htmlFor={`ni-name-${uid}`}>Hvad er det?</label>
        <input id={`ni-name-${uid}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Fx Uldfrakke, kamel" />
      </div>
      <span className="flabel" aria-hidden="true">Salgsform</span>
      <fieldset className="seg sale-seg">
        <legend className="sr-only">Salgsform</legend>
        <label>
          <input type="radio" name={`ni-type-${uid}`} checked={saleType === "fixed"} onChange={() => setSaleType("fixed")} />
          <span>Fast pris</span>
        </label>
        <label>
          <input type="radio" name={`ni-type-${uid}`} checked={saleType === "auction"} onChange={() => setSaleType("auction")} />
          <span>Budsalg</span>
        </label>
      </fieldset>
      <div className="fgrid" style={{ marginTop: 0 }}>
        <div className="field">
          <label htmlFor={`ni-size-${uid}`}>Str.</label>
          <input id={`ni-size-${uid}`} value={size} onChange={(e) => setSize(e.target.value)} maxLength={20} placeholder="M" />
        </div>
        <div className="field">
          <label htmlFor={`ni-price-${uid}`}>{saleType === "auction" ? "Startpris (kr)" : "Pris (kr)"}</label>
          <input id={`ni-price-${uid}`} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="150" />
        </div>
        <div className="field full">
          <label htmlFor={`ni-cond-${uid}`}>Stand</label>
          {newOnly ? (
            <input id={`ni-cond-${uid}`} value={NEW_ONLY_CONDITION} readOnly aria-readonly="true" />
          ) : (
            <input id={`ni-cond-${uid}`} value={cond} onChange={(e) => setCond(e.target.value)} maxLength={40} placeholder="Fx Som ny" />
          )}
        </div>
      </div>
      {newOnly ? (
        <label className="check-line">
          <input type="checkbox" checked={newOk} onChange={(e) => setNewOk(e.target.checked)} />
          <span>Produktet er nyt og uåbnet (forseglingen er intakt). Brugt makeup og hudpleje må ikke sælges.</span>
        </label>
      ) : null}
      {authNeeded ? (
        <p className="notice auth-note" role="status">
          <span>
            <b>Ægthedstjek:</b> mærkevarer skal tjekkes af Relived, før de kan vises live eller købes. Når varen er i køen, trykker du
            <b> Send billeder</b> og lægger nærbilleder af logo, koder og syninger op.
          </span>
        </p>
      ) : null}
      {saleType === "auction" ? (
        <p className="fine" style={{ marginTop: -4 }}>
          Buddene starter ved startprisen, og det højeste bud vinder. Byder ingen, kan varen købes til startprisen efter showet.
        </p>
      ) : null}
      {more ? (
        <>
          <div className="field">
            <label htmlFor={`ni-cat-${uid}`}>Kategori</label>
            <select id={`ni-cat-${uid}`} value={cat} onChange={(e) => setCat(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`ni-desc-${uid}`}>Beskrivelse (valgfri)</label>
            <textarea
              id={`ni-desc-${uid}`}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={1000}
              placeholder="Mærke, mål, materiale og eventuelle fejl"
            />
          </div>
          <div className="field">
            <span className="flabel">Billeder (valgfri, op til {MAX_OWN})</span>
            <div className="photo-row">
              {photos.map((ph, i) => (
                <div className="pthumb" key={ph.kind === "old" ? ph.path : ph.url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.kind === "old" ? storageUrl("items", ph.path) : ph.url} alt="" />
                  <button type="button" className="pthumb-x" onClick={() => removePhoto(i)} aria-label={`Fjern billede ${i + 1}`}>×</button>
                </div>
              ))}
              {photos.length < MAX_ALL ? (
                <label className="pthumb add">
                  <input ref={fileRef} className="file-input" type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
                  <span aria-hidden="true">+</span>
                  <span className="sr-only">Tilføj billeder</span>
                </label>
              ) : null}
            </div>
            <span className="fine">Varerne kan ses på Relived før showet. Et billede fra kameraet kommer også på, når du viser varen live.</span>
          </div>
        </>
      ) : (
        <button className="linkbtn" type="button" onClick={() => setMore(true)} style={{ alignSelf: "flex-start" }}>
          + Billeder, beskrivelse og kategori
        </button>
      )}
      {err ? <p className="err" role="alert">{err}</p> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button className={editing ? "btn btn-red btn-sm" : "btn btn-ghost btn-block"} type="submit" disabled={busy}>
          {busy ? "Gemmer …" : editing ? "Gem" : "Læg i køen"}
        </button>
        {onCancel ? (
          <button className="btn btn-line btn-sm" type="button" onClick={onCancel} disabled={busy}>Fortryd</button>
        ) : null}
      </div>
    </form>
  );
}
