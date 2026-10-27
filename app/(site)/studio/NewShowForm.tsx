"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { errorText } from "@/lib/toast";

function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewShowForm({ sellerId, englishReady = false }: { sellerId: string; englishReady?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState<string>("dametoej");
  const [start, setStart] = useState(defaultStart);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [english, setEnglish] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (t.length < 3) return setErr("Giv showet en titel på mindst 3 tegn, fx \"Sommerkjoler i str. S–M\".");
    const when = start ? new Date(start) : null;
    if (when && Number.isNaN(when.getTime())) return setErr("Vælg et gyldigt tidspunkt.");
    setBusy(true);
    setErr(null);
    const { data, error } = await getSupabase()
      .from("shows")
      .insert({
        seller_id: sellerId,
        title: t,
        category: cat,
        starts_at: when ? when.toISOString() : null,
        // Kun når 0023_engelsk.sql er kørt (ellers findes kolonnen ikke).
        ...(englishReady && english ? { language: "en" } : {}),
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return setErr(errorText(error));
    router.push(`/studio/${data.id}`);
  }

  return (
    <form className="inline-form" onSubmit={create} noValidate>
      <h2 className="h3">Nyt show</h2>
      <div className="fgrid">
        <div className="field wide">
          <label htmlFor="ns-title">Titel</label>
          <input id="ns-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Fx Sommerkjoler og strik i str. S–M" aria-invalid={Boolean(err)} />
        </div>
        <div className="field">
          <label htmlFor="ns-cat">Kategori</label>
          <select id="ns-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ns-start">Starter</label>
          <input id="ns-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
      </div>
      {englishReady ? (
        <label className="ns-lang">
          <input type="checkbox" checked={english} onChange={(e) => setEnglish(e.target.checked)} />
          <span>
            <b>Showet er på engelsk</b>
            <br />
            Så får det mærket English, og engelsktalende købere kan finde det på siden Relived in English.
          </span>
        </label>
      ) : null}
      {err ? <p className="err" role="alert">{err}</p> : null}
      <div>
        <button className="btn btn-red" type="submit" disabled={busy}>{busy ? "Opretter …" : "Opret show og læg ting ind"}</button>
      </div>
    </form>
  );
}
