"use client";

import { useEffect, useState } from "react";
import { IconShieldCheck } from "@/components/Icons";
import { AUTH_SHOTS } from "@/lib/luxury";
import { fitImage } from "@/lib/resizeImage";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

type Shot = { file: File; url: string };

/**
 * Ægthedstjek: sælgeren lægger nærbilleder af tingen op, og Relived godkender den i Backoffice,
 * før den kan vises live eller købes.
 */
export default function AuthPanel({
  sellerId,
  itemId,
  itemName,
  note,
  onSent,
  onClose,
}: {
  sellerId: string;
  itemId: string;
  itemName: string;
  /** Begrundelsen, hvis tingen blev afvist sidst. */
  note?: string | null;
  onSent: () => void;
  onClose: () => void;
}) {
  const [shots, setShots] = useState<Record<string, Shot>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(
    () => () => Object.values(shots).forEach((s) => URL.revokeObjectURL(s.url)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function pick(key: string, files: FileList | null) {
    const f = files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    setShots((s) => {
      if (s[key]) URL.revokeObjectURL(s[key].url);
      return { ...s, [key]: { file: f, url: URL.createObjectURL(f) } };
    });
  }

  const missing = AUTH_SHOTS.filter((s) => s.need && !shots[s.key]);

  async function send() {
    if (missing.length) return setErr(`Mangler: ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`);
    setErr(null);
    setBusy(true);
    try {
      const sb = getSupabase();
      const paths: string[] = [];
      for (const s of AUTH_SHOTS) {
        const shot = shots[s.key];
        if (!shot) continue;
        // Billederne bliver ikke beskåret, så koder og prægninger i kanten kommer med.
        const jpeg = await fitImage(shot.file, 1800, 0.88);
        const path = `${sellerId}/${itemId}/auth-${s.key}${Date.now().toString(36)}.jpg`;
        const up = await sb.storage.from("items").upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (up.error) throw up.error;
        paths.push(path);
      }
      const r = await fetch("/api/aegthed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, photos: paths }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Billederne kunne ikke sendes.");
      toast("Sendt til ægthedstjek. Du får en mail, når vi har kigget på den.");
      onSent();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-panel">
      <div className="auth-head">
        <IconShieldCheck width={22} height={22} />
        <div>
          <strong>Ægthedstjek: {itemName}</strong>
          <p className="muted">
            Mærkevarer skal tjekkes af Relived, før de kan vises live eller købes. Tag skarpe nærbilleder i godt lys. Vi svarer
            normalt samme dag.
          </p>
        </div>
      </div>
      {note ? (
        <p className="notice" role="status">
          <span>
            <b>Sidst blev den afvist:</b> {note}
          </span>
        </p>
      ) : null}
      <ul className="auth-shots">
        {AUTH_SHOTS.map((s) => (
          <li key={s.key}>
            <label className={`auth-shot${shots[s.key] ? " has" : ""}`}>
              <input className="file-input" type="file" accept="image/*" onChange={(e) => pick(s.key, e.target.files)} />
              {shots[s.key] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shots[s.key].url} alt="" />
              ) : (
                <span className="auth-plus" aria-hidden="true">+</span>
              )}
              <span className="auth-label">
                {s.label}
                {s.need ? null : <span className="muted"> (valgfri)</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {err ? (
        <p className="err" role="alert">
          {err}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-red btn-sm" type="button" onClick={send} disabled={busy}>
          {busy ? "Sender …" : "Send til tjek"}
        </button>
        <button className="btn btn-line btn-sm" type="button" onClick={onClose} disabled={busy}>
          Luk
        </button>
      </div>
    </div>
  );
}
