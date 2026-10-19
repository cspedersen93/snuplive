"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HANDLE_RE } from "@/lib/format";
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
