"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ISSUE_PHOTOS_MAX, ISSUE_REASONS, PHOTO_REASONS, type IssueReason } from "@/lib/issues";
import { fitImage } from "@/lib/resizeImage";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/**
 * "Meld et problem": køberen fortæller, hvad der er galt, og pengene holdes tilbage.
 * Er varen ikke som vist, gået i stykker eller falsk, skal køberen vedhæfte billeder af varen, som den kom.
 * Billederne lægges i en lukket mappe og kan ikke byttes ud bagefter. photosReady er falsk, før 0038 er kørt.
 */
export default function ReportProblem({ orderId, uid, business = false, photosReady = false }: { orderId: string; uid: string; business?: boolean; photosReady?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<IssueReason | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const needPhotos = photosReady && !!reason && PHOTO_REASONS.includes(reason);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].slice(0, ISSUE_PHOTOS_MAX - photos.length);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      const sb = getSupabase();
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error("Vælg billeder (JPG, PNG eller HEIC fra telefonen).");
        if (file.size > 20 * 1024 * 1024) throw new Error("Et af billederne er for stort. Vælg billeder under 20 MB.");
        const jpeg = await fitImage(file, 1600, 0.85);
        const path = `${uid}/sag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const up = await sb.storage.from("issues").upload(path, jpeg, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        setPhotos((cur) => [...cur, { path, url: URL.createObjectURL(jpeg) }]);
      }
    } catch (err) {
      toast(errorText(err, "Billedet kunne ikke gemmes. Prøv et andet billede."));
    } finally {
      setUploading(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return toast("Vælg, hvad problemet er.");
    if (message.trim().length < 10) return toast("Skriv lidt mere om, hvad der er galt.");
    if (needPhotos && photos.length === 0) return toast("Vedhæft mindst ét billede af varen, som den ser ud nu.");
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/problem`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, message, photos: photos.map((p) => p.path), photosReady }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke at melde problemet.");
      toast("Tak. Vi holder pengene tilbage og vender tilbage på mail.");
      router.refresh();
    } catch (err) {
      toast(errorText(err));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="linkbtn" type="button" onClick={() => setOpen(true)}>
        Er der et problem med ordren? Meld det her
      </button>
    );
  }
  return (
    <form className="problem-form" onSubmit={send}>
      <fieldset>
        <legend>Hvad er problemet?</legend>
        {/* Fortrydelse gælder kun ved køb fra en virksomhed. */}
        {(Object.keys(ISSUE_REASONS) as IssueReason[]).filter((k) => business || k !== "withdrawal").map((k) => (
          <label key={k}>
            <input type="radio" name={`issue-${orderId}`} checked={reason === k} onChange={() => setReason(k)} />
            <span>{ISSUE_REASONS[k]}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor={`issue-msg-${orderId}`}>Fortæl kort, hvad der er sket</label>
        <textarea
          id={`issue-msg-${orderId}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          placeholder="Fx: Kjolen har en plet på ryggen, som ikke blev vist i showet."
        />
      </div>
      {reason === "counterfeit" ? (
        <p className="fine">
          Fortæl, hvorfor du tror, den er falsk, og tag gerne billeder af logo og koder. Har du fået den vurderet af en ægthedstjeneste
          eller en butik, så skriv det. Er den falsk, får du alle pengene tilbage, og sælgeren bliver lukket.
        </p>
      ) : null}
      {photosReady ? (
        <div className="field">
          <span className="problem-ph-l">
            Billeder af varen{needPhotos ? "" : " (valgfrit)"}
          </span>
          <p className="fine">
            {needPhotos
              ? "Tag billeder af varen, som den ser ud nu, og af det, der er galt. Tag også gerne et af pakken. Vi sammenligner med videoen fra showet."
              : "Har du billeder, der viser problemet, så læg dem her."}
          </p>
          {photos.length ? (
            <ul className="problem-ph">
              {photos.map((p, n) => (
                <li key={p.path}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Billede ${n + 1} af varen`} />
                  <button type="button" aria-label={`Fjern billede ${n + 1}`} onClick={() => setPhotos((cur) => cur.filter((x) => x.path !== p.path))} disabled={busy}>
                    Fjern
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {photos.length < ISSUE_PHOTOS_MAX ? (
            <label className="btn btn-line btn-sm problem-ph-add">
              <input type="file" accept="image/*" multiple onChange={onFiles} disabled={uploading || busy} />
              {uploading ? "Gemmer billede …" : photos.length ? "Tilføj flere billeder" : "Vælg billeder"}
            </label>
          ) : null}
        </div>
      ) : null}
      <p className="fine">
        Pengene holdes tilbage hos Relived, indtil sagen er afgjort. Sælgeren kan se, hvad du skriver{photosReady ? " og dine billeder" : ""}.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-ivory btn-sm" type="submit" disabled={busy || uploading}>{busy ? "Sender …" : "Meld problemet"}</button>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setOpen(false)} disabled={busy}>Fortryd</button>
      </div>
    </form>
  );
}
