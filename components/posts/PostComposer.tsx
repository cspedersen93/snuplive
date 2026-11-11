"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { POST_IMAGES_MAX, POST_MAX } from "@/lib/posts";
import { fitImage } from "@/lib/resizeImage";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

type ShowOpt = { id: string; title: string };

/**
 * Sælgeren skriver et opslag på sin egen profil: tekst, op til fire billeder og eventuelt et af sine kommende shows.
 * Billederne lægges i sælgerens egen mappe i lageret, og opslaget gemmes via /api/opslag, som også giver følgerne besked.
 */
export default function PostComposer({ uid, shows }: { uid: string; shows: ShowOpt[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [images, setImages] = useState<{ path: string; url: string }[]>([]);
  const [showId, setShowId] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].slice(0, POST_IMAGES_MAX - images.length);
    e.target.value = "";
    if (!files.length) return;
    setErr(null);
    setUploading(true);
    const sb = getSupabase();
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error("Vælg billeder (JPG, PNG eller HEIC fra telefonen).");
        if (file.size > 20 * 1024 * 1024) throw new Error("Et af billederne er for stort. Vælg billeder under 20 MB.");
        const jpeg = await fitImage(file, 1400, 0.82);
        const path = `${uid}/opslag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const up = await sb.storage.from("covers").upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (up.error) throw up.error;
        setImages((cur) => [...cur, { path, url: URL.createObjectURL(jpeg) }]);
      }
    } catch (e2) {
      setErr(errorText(e2, "Billedet kunne ikke gemmes. Prøv et andet billede."));
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(path: string) {
    setImages((cur) => cur.filter((i) => i.path !== path));
    await getSupabase().storage.from("covers").remove([path]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return setErr("Skriv noget i opslaget.");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/opslag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text, images: images.map((i) => i.path), show_id: showId || null }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string; pushed?: number };
      if (!res.ok) throw new Error(out.error || "Opslaget kunne ikke gemmes.");
      setBody("");
      setImages([]);
      setShowId("");
      toast(out.pushed ? `Opslaget er delt, og ${out.pushed} ${out.pushed === 1 ? "følger" : "følgere"} har fået besked` : "Opslaget er delt");
      router.refresh();
    } catch (e2) {
      setErr(errorText(e2, "Opslaget kunne ikke gemmes."));
    } finally {
      setBusy(false);
    }
  }

  const left = POST_MAX - body.length;
  return (
    <form className="post-new" onSubmit={send} noValidate>
      <label className="sr-only" htmlFor="post-body">Skriv et opslag</label>
      <textarea
        id="post-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={POST_MAX}
        rows={3}
        placeholder="Fortæl dine følgere, hvad du viser frem næste gang"
      />
      {images.length ? (
        <ul className="post-new-imgs">
          {images.map((i) => (
            <li key={i.path}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt="" />
              <button type="button" aria-label="Fjern billedet" onClick={() => removeImage(i.path)}>×</button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="post-new-row">
        <input id="post-files" className="file-input" type="file" accept="image/*" multiple onChange={onFiles} disabled={uploading || images.length >= POST_IMAGES_MAX} />
        <label className={`btn btn-line btn-sm${uploading ? " is-busy" : ""}`} htmlFor="post-files" aria-disabled={images.length >= POST_IMAGES_MAX}>
          {uploading ? "Henter …" : images.length >= POST_IMAGES_MAX ? "4 billeder er valgt" : "Tilføj billeder"}
        </label>
        {shows.length ? (
          <span className="post-new-show">
            <label className="sr-only" htmlFor="post-show">Hvilket show handler opslaget om?</label>
            <select id="post-show" value={showId} onChange={(e) => setShowId(e.target.value)}>
              <option value="">Ikke om et bestemt show</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>Om showet: {s.title}</option>
              ))}
            </select>
          </span>
        ) : null}
        <span className={`post-new-left${left < 40 ? " low" : ""}`} aria-live="polite">{left}</span>
        <button className="btn btn-ivory btn-sm" type="submit" disabled={busy || uploading || !body.trim()}>{busy ? "Deler …" : "Del opslag"}</button>
      </div>
      {err ? <p className="err" role="alert">{err}</p> : null}
    </form>
  );
}
