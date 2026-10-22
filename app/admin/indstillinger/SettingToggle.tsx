"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

export default function SettingToggle({ settingKey, value, label, help, disabled = false }: { settingKey: string; value: boolean; label: string; help?: string; disabled?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(value);
  const [busy, setBusy] = useState(false);
  async function change(next: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: settingKey, value: next }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke at gemme.");
      setOn(next);
      toast(next ? "Slået til." : "Slået fra.");
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <label className="check setting-toggle">
      <input type="checkbox" checked={on} disabled={busy || disabled} onChange={(e) => change(e.target.checked)} />
      <span>
        <b>{label}</b>
        {help ? <span className="muted" style={{ display: "block", fontSize: ".88rem", marginTop: 2 }}>{help}</span> : null}
      </span>
    </label>
  );
}
