"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

/** Slet alle testshows: kun mens betalingen kører i testtilstand. Skal bekræftes ved at skrive SLET. */
export default function DeleteTestShows({ shows, items }: { shows: number; items: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const r = await fetch("/api/admin/slet-testshows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: word.trim().toUpperCase() }),
    });
    const j = (await r.json().catch(() => null)) as { error?: string; deleted?: { shows?: number; items?: number } } | null;
    setBusy(false);
    if (!r.ok) return toast(j?.error ?? "Det virkede ikke. Prøv igen.");
    setOpen(false);
    setWord("");
    toast(`Slettet: ${j?.deleted?.shows ?? 0} shows og ${j?.deleted?.items ?? 0} varer.`);
    router.refresh();
  }

  if (!shows) return <p className="fine">Der er ingen shows. Siden er klar til de første rigtige shows.</p>;
  return open ? (
    <div className="reset-box" role="group" aria-label="Bekræft sletning af shows">
      <p className="muted" style={{ fontSize: ".9375rem" }}>
        Det kan ikke fortrydes. Skriv <b>SLET</b> for at slette {shows} {shows === 1 ? "show" : "shows"} og {items}{" "}
        {items === 1 ? "vare" : "varer"} med chat, bud og alle testkøb.
      </p>
      <div className="reset-row">
        <label className="sr-only" htmlFor="delete-shows-word">Skriv SLET</label>
        <input id="delete-shows-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder="SLET" autoComplete="off" />
        <button className="btn btn-red btn-sm" type="button" onClick={run} disabled={busy || word.trim().toUpperCase() !== "SLET"}>
          {busy ? "Sletter …" : "Slet nu"}
        </button>
        <button className="linkbtn" type="button" onClick={() => { setOpen(false); setWord(""); }}>Fortryd</button>
      </div>
    </div>
  ) : (
    <button className="btn btn-line btn-sm" type="button" onClick={() => setOpen(true)} style={{ alignSelf: "flex-start" }}>
      Slet alle testshows
    </button>
  );
}
