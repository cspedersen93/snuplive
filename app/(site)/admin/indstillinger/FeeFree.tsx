"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

/** Start og stop af gratis-kampagnen (0 kr i køberbeskyttelse). */
export default function FeeFree({ active, suggest, min }: { active: boolean; suggest: string; min: string }) {
  const router = useRouter();
  const [until, setUntil] = useState(suggest);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);

  async function send(action: "start" | "stop") {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/gratis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, until }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke at gemme.");
      toast(action === "start" ? "Kampagnen er startet." : "Kampagnen er stoppet.");
      setAsk(false);
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (ask) {
    return (
      <div className="confirm-ask" data-fee-free="ask">
        <span>
          {active
            ? "Stop kampagnen nu? Køberbeskyttelsen koster igen 5 % + 5 kr med det samme, og teksterne på siden skifter tilbage."
            : "Start kampagnen nu? Køberbeskyttelsen koster 0 kr for alle, og siden skriver det med slutdatoen."}
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-red btn-sm" type="button" disabled={busy} onClick={() => send(active ? "stop" : "start")}>
            {busy ? "Gemmer …" : active ? "Ja, stop kampagnen" : "Ja, start kampagnen"}
          </button>
          <button className="btn btn-line btn-sm" type="button" disabled={busy} onClick={() => setAsk(false)}>
            Fortryd
          </button>
        </div>
      </div>
    );
  }
  if (active) {
    return (
      <button className="btn btn-line btn-sm" type="button" data-fee-free="stop" onClick={() => setAsk(true)} style={{ alignSelf: "flex-start" }}>
        Stop kampagnen nu
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="ff-until">Sidste dag med 0 kr i gebyr</label>
        <input id="ff-until" type="date" value={until} min={min} onChange={(e) => setUntil(e.target.value)} />
      </div>
      <button className="btn btn-red btn-sm" type="button" data-fee-free="start" disabled={!until} onClick={() => setAsk(true)}>
        Start kampagnen
      </button>
    </div>
  );
}
