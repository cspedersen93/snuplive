"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

/** Godkend eller afvis et ægthedstjek. Afviser I, skal sælgeren have en kort begrundelse. */
export default function AuthDecision({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approve" | "reject") {
    if (decision === "reject" && note.trim().length < 5) return toast("Skriv kort, hvorfor den er afvist. Sælgeren får det på mail.");
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/aegthed/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke.");
      toast(decision === "approve" ? "Godkendt. Sælgeren har fået besked." : "Afvist. Sælgeren har fået besked.");
      router.refresh();
    } catch (e) {
      toast(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="adm-auth-actions">
      <label className="sr-only" htmlFor={`note-${id}`}>Besked til sælgeren</label>
      <textarea
        id={`note-${id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Besked til sælgeren (skal udfyldes ved afvisning), fx: Datokoden er ikke skarp. Tag et nyt billede tæt på."
      />
      <button className="btn btn-red btn-sm" type="button" onClick={() => decide("approve")} disabled={busy}>
        Godkend
      </button>
      <button className="btn btn-line btn-sm" type="button" onClick={() => decide("reject")} disabled={busy}>
        Afvis
      </button>
    </div>
  );
}
