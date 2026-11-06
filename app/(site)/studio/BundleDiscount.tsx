"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { kr } from "@/lib/format";
import { BUNDLE_STEPS, bundleDiscount, type BundleTiers } from "@/lib/pricing";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/** Samlerabat (0027_samlerabat.sql): sælgeren giver rabat, når køberen køber flere varer hos hende. */
export default function BundleDiscount({ initial }: { initial: BundleTiers }) {
  const router = useRouter();
  const [pct2, setPct2] = useState(initial.pct2);
  const [pct3, setPct3] = useState(Math.max(initial.pct2, initial.pct3));
  const [busy, setBusy] = useState(false);
  const three = Math.max(pct2, pct3);
  const changed = pct2 !== initial.pct2 || three !== Math.max(initial.pct2, initial.pct3);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabase().rpc("set_bundle_discount", { p_pct2: pct2, p_pct3: three });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(pct2 || three ? "Samlerabatten er gemt. Køberne kan se den ved dine varer og i dine shows." : "Du giver ikke længere samlerabat.");
    router.refresh();
  }

  // Eksempel med to og tre varer til 200 kr. stykket.
  const ex2 = 400 - bundleDiscount(400, 2, { pct2, pct3: three });
  const ex3 = 600 - bundleDiscount(600, 3, { pct2, pct3: three });

  return (
    <form className="box bundle-box" onSubmit={save} aria-labelledby="h-samlerabat" id="samlerabat">
      <h2 className="h3" id="h-samlerabat" style={{ marginBottom: 4 }}>Samlerabat</h2>
      <p className="muted" style={{ fontSize: ".875rem" }}>
        Giv rabat, når en køber køber flere varer hos dig. Varerne sendes alligevel i én pakke, og rabatten bliver trukket
        automatisk, når køberen betaler. Den gælder både i dine shows og på de varer, du har til salg.
      </p>
      <div className="bundle-fields">
        <div className="field">
          <label htmlFor="br-2">Ved 2 varer</label>
          <select id="br-2" value={pct2} onChange={(e) => setPct2(Number(e.target.value))}>
            {BUNDLE_STEPS.map((p) => (
              <option key={p} value={p}>{p ? `${p} % rabat` : "Ingen rabat"}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="br-3">Ved 3 eller flere</label>
          <select id="br-3" value={three} onChange={(e) => setPct3(Number(e.target.value))}>
            {BUNDLE_STEPS.filter((p) => p >= pct2).map((p) => (
              <option key={p} value={p}>{p ? `${p} % rabat` : "Ingen rabat"}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-red" type="submit" disabled={busy || !changed}>
          {busy ? "Gemmer …" : "Gem samlerabat"}
        </button>
      </div>
      <p className="fine" aria-live="polite">
        {pct2 || three
          ? `Eksempel: Varer til 200 kr stykket koster ${kr(ex2)} for 2 og ${kr(ex3)} for 3. Du får beløbet efter rabatten.`
          : "Du giver ingen samlerabat lige nu."}
      </p>
    </form>
  );
}
