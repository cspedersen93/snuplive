"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, toast } from "@/lib/toast";

export interface Tester {
  email: string;
  note: string | null;
}

/** Testere, der må se hele siden, før den åbner. Admins har altid adgang. */
export default function Testers({ testers }: { testers: Tester[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(method: "POST" | "DELETE", body: object, done: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/beta", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke.");
      toast(done);
      router.refresh();
      return true;
    } catch (e) {
      toast(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call("POST", { email, note }, "Testeren er tilføjet.")) {
      setEmail("");
      setNote("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {testers.length ? (
        <ul className="list">
          {testers.map((t) => (
            <li key={t.email} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div>
                <strong>{t.email}</strong>
                {t.note ? <span>{t.note}</span> : null}
              </div>
              <button className="btn btn-line btn-sm" type="button" disabled={busy} onClick={() => call("DELETE", { email: t.email }, "Testeren er fjernet.")}>
                Fjern
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ fontSize: ".92rem" }}>Ingen testere endnu. Admins har altid adgang.</p>
      )}
      <form className="tester-form" onSubmit={add}>
        <div className="field">
          <label htmlFor="tester-email">E-mail</label>
          <input id="tester-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="tester-note">Note (valgfri)</label>
          <input id="tester-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Fx første sælger, vintagebutik" />
        </div>
        <button className="btn btn-red btn-sm" type="submit" disabled={busy}>Tilføj tester</button>
      </form>
    </div>
  );
}
