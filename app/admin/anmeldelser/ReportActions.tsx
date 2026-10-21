"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { REMOVE_TEXT } from "@/lib/moderation";
import type { ReportTarget } from "@/lib/reports";
import { errorText, toast } from "@/lib/toast";

/** Fjern eller afvis. Begrundelsen bliver sendt til sælgeren, når noget bliver fjernet. */
export default function ReportActions({ reportId, type }: { reportId: string; type: ReportTarget | null }) {
  const router = useRouter();
  const id = useId();
  const [decision, setDecision] = useState("");
  const [ask, setAsk] = useState<"remove" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "remove" | "reject") {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/reports/${reportId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, decision }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke.");
      toast(action === "remove" ? "Fjernet. Sælgeren har fået besked." : "Anmeldelsen er afvist.");
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
      setAsk(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {type ? (
        <div className="field">
          <label htmlFor={`${id}-why`}>Begrundelse til sælgeren (skal med, når du fjerner noget)</label>
          <textarea
            id={`${id}-why`}
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            maxLength={1000}
            placeholder="Fx: Tasken er en kopivare, og kopivarer må ikke sælges på SnupLive."
          />
        </div>
      ) : (
        <p className="muted" style={{ fontSize: ".9rem" }}>Det er allerede fjernet. Afvis anmeldelsen for at lukke sagen.</p>
      )}
      {ask ? (
        <div className="confirm-ask">
          <span>{ask === "remove" && type ? `${REMOVE_TEXT[type].ask} ` : "Intet bliver fjernet. "}Den, der anmeldte, får besked.</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-red btn-sm" type="button" onClick={() => run(ask)} disabled={busy}>
              {busy ? "Arbejder …" : "Ja, gør det"}
            </button>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(null)} disabled={busy}>Fortryd</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {type ? (
            <button
              className="btn btn-red btn-sm"
              type="button"
              onClick={() => (decision.trim().length < 5 ? toast("Skriv en begrundelse til sælgeren først.") : setAsk("remove"))}
            >
              {REMOVE_TEXT[type].button}
            </button>
          ) : null}
          <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk("reject")}>Afvis anmeldelsen</button>
        </div>
      )}
    </div>
  );
}
