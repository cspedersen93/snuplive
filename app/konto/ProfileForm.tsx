"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import { HANDLE_RE } from "@/lib/format";
import { resizeImage } from "@/lib/resizeImage";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import type { Profile } from "@/lib/types";

export default function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [handle, setHandle] = useState(profile.handle);
  const [name, setName] = useState(profile.display_name ?? "");
  const [area, setArea] = useState(profile.area ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarPath, setAvatarPath] = useState(profile.avatar_path ?? null);
  const [uploading, setUploading] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setImgErr("Vælg et billede (JPG, PNG eller HEIC fra telefonen).");
    if (file.size > 20 * 1024 * 1024) return setImgErr("Billedet er for stort. Vælg et under 20 MB.");
    setImgErr(null);
    setUploading(true);
    const sb = getSupabase();
    try {
      const jpeg = await resizeImage(file, 400, 400);
      const path = `${profile.id}/avatar-${Date.now().toString(36)}.jpg`;
      const up = await sb.storage.from("avatars").upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (up.error) throw up.error;
      const { error } = await sb.from("profiles").update({ avatar_path: path }).eq("id", profile.id);
      if (error) throw error;
      if (avatarPath) await sb.storage.from("avatars").remove([avatarPath]);
      setAvatarPath(path);
      toast("Dit profilbillede er gemt");
      window.dispatchEvent(new Event("snup:changed"));
      router.refresh();
    } catch (err) {
      setImgErr(errorText(err, "Billedet kunne ikke gemmes. Prøv et andet billede."));
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    if (!avatarPath) return;
    setUploading(true);
    const sb = getSupabase();
    const { error } = await sb.from("profiles").update({ avatar_path: null }).eq("id", profile.id);
    if (!error) await sb.storage.from("avatars").remove([avatarPath]);
    setUploading(false);
    if (error) return setImgErr(errorText(error));
    setAvatarPath(null);
    window.dispatchEvent(new Event("snup:changed"));
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const h = handle.trim().toLowerCase();
    if (!HANDLE_RE.test(h)) return setErr("Brugernavnet må kun have små bogstaver, tal, punktum og _ (3–24 tegn).");
    setBusy(true);
    setErr(null);
    const { error } = await getSupabase()
      .from("profiles")
      .update({ handle: h, display_name: name.trim() || null, area: area.trim() || null })
      .eq("id", profile.id);
    setBusy(false);
    if (error) return setErr(errorText(error));
    setHandle(h);
    toast("Din profil er gemt");
    router.refresh();
  }

  return (
    <form className="inline-form" onSubmit={save} noValidate>
      <h2 className="h3">Profil</h2>
      <div className="avatar-edit">
        <Avatar handle={handle || profile.handle} path={avatarPath} size={76} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input id="pf-avatar" className="file-input" type="file" accept="image/*" onChange={onFile} disabled={uploading} />
            <label className={`btn btn-line btn-sm${uploading ? " is-busy" : ""}`} htmlFor="pf-avatar">
              {uploading ? "Gemmer …" : avatarPath ? "Skift profilbillede" : "Tilføj profilbillede"}
            </label>
            {avatarPath && !uploading ? (
              <button className="linkbtn" type="button" onClick={removeAvatar}>Fjern billede</button>
            ) : null}
          </div>
          <span className="fine">Vises på dine shows, på din sælgerside og under Live nu.</span>
          {imgErr ? <span className="err" role="alert">{imgErr}</span> : null}
        </div>
      </div>
      <div className="fgrid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="field">
          <label htmlFor="pf-handle">Brugernavn</label>
          <input id="pf-handle" value={handle} onChange={(e) => setHandle(e.target.value)} autoComplete="username" maxLength={24} aria-invalid={Boolean(err)} />
        </div>
        <div className="field">
          <label htmlFor="pf-name">Navn (valgfrit)</label>
          <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} placeholder="Fx Maja" />
        </div>
        <div className="field">
          <label htmlFor="pf-area">Område (valgfrit)</label>
          <input id="pf-area" value={area} onChange={(e) => setArea(e.target.value)} maxLength={40} placeholder="Fx Nørrebro" />
        </div>
      </div>
      <p className="fine">Dit brugernavn bliver vist i chatten og i adressen til dine shows: snuplive.dk/live/{handle.trim().toLowerCase() || "brugernavn"}</p>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <div>
        <button className="btn btn-red" type="submit" disabled={busy}>{busy ? "Gemmer …" : "Gem profil"}</button>
      </div>
    </form>
  );
}
