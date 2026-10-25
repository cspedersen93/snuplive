"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

/** Nulstil testsalg: kun mens betalingen kører i testtilstand. Skal bekræftes ved at skrive NULSTIL. */
export default function ResetTestSales({ orders, sales }: { orders: number; sales: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    const r = await fetch("/api/admin/nulstil-testsalg", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: word.trim().toUpperCase() }),
    });
    const j = (await r.json().catch(() => null)) as { error?: string; deleted?: { orders?: number; sales?: number } } | null;
    setBusy(false);
    if (!r.ok) return toast(j?.error ?? "Det virkede ikke. Prøv igen.");
    setOpen(false);
    setWord("");
    toast(`Testsalget er nulstillet: ${j?.deleted?.orders ?? 0} ordrer og ${j?.deleted?.sales ?? 0} køb er slettet.`);
    router.refresh();
  }

  if (!orders && !sales) return <p className="fine">Der er ingen køb eller ordrer lige nu. Omsætningen står på 0.</p>;
  return open ? (
    <div className="reset-box" role="group" aria-label="Bekræft nulstilling">
      <p className="muted" style={{ fontSize: ".92rem" }}>
        Det kan ikke fortrydes. Skriv <b>NULSTIL</b> for at slette {orders} {orders === 1 ? "ordre" : "ordrer"} og {sales} køb.
      </p>
      <div className="reset-row">
        <label className="sr-only" htmlFor="reset-word">Skriv NULSTIL</label>
        <input id="reset-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder="NULSTIL" autoComplete="off" />
        <button className="btn btn-red btn-sm" type="button" onClick={reset} disabled={busy || word.trim().toUpperCase() !== "NULSTIL"}>
          {busy ? "Nulstiller …" : "Nulstil nu"}
        </button>
        <button className="linkbtn" type="button" onClick={() => { setOpen(false); setWord(""); }}>Fortryd</button>
      </div>
    </div>
  ) : (
    <button className="btn btn-line btn-sm" type="button" onClick={() => setOpen(true)} style={{ alignSelf: "flex-start" }}>
      Nulstil testsalg
    </button>
  );
}
