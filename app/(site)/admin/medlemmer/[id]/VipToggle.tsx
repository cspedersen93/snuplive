"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

/** Gør medlemmet til VIP-sælger eller VIP-køber, uanset antal handler (0032_niveauer.sql). */
export default function VipToggle({ user, role, value, label }: { user: string; role: "seller" | "buyer"; value: boolean; label: string }) {
  const router = useRouter();
  const [on, setOn] = useState(value);
  const [busy, setBusy] = useState(false);
  async function change(next: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/vip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user, role, value: next }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke at gemme.");
      setOn(next);
      toast(next ? `${label}: slået til.` : `${label}: slået fra.`);
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <label className="check setting-toggle" data-vip={role}>
      <input type="checkbox" checked={on} disabled={busy} onChange={(e) => change(e.target.checked)} />
      <span>
        <b>{label}</b>
        <span className="muted" style={{ display: "block", fontSize: ".88rem", marginTop: 2 }}>
          Får VIP ved navnet med det samme, uanset hvor mange handler der er.
        </span>
      </span>
    </label>
  );
}
