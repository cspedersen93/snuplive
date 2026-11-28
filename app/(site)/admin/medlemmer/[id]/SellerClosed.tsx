"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

/**
 * Relived har lukket medlemmets sælgerprofil (Backoffice → Anmeldelser). Medlemmet kan ikke selv blive sælger igen,
 * før lukningen er fjernet her (0042_rettelser.sql).
 */
export default function SellerClosed({ user, closedAt }: { user: string; closedAt: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function reopen() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/lukket-saelger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke.");
      toast("Sælgerprofilen er åbnet. Medlemmet kan nu selv trykke Bliv sælger.");
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
      setAsk(false);
    }
  }
  return (
    <div className="issue-note" role="status" data-seller-closed>
      <b>Relived har lukket sælgerprofilen {closedAt}</b>
      <span>Medlemmet kan ikke selv blive sælger igen, før I åbner den her.</span>
      {ask ? (
        <div className="confirm-ask">
          <span>Medlemmet kan derefter selv trykke Bliv sælger. Varer og shows, der blev fjernet ved lukningen, kommer ikke tilbage.</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ivory btn-sm" type="button" onClick={reopen} disabled={busy}>
              {busy ? "Arbejder …" : "Ja, åbn sælgerprofilen"}
            </button>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(false)} disabled={busy}>Fortryd</button>
          </div>
        </div>
      ) : (
        <div>
          <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(true)}>Åbn sælgerprofilen igen</button>
        </div>
      )}
    </div>
  );
}
