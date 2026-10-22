"use client";

import { useState } from "react";
import ShowCard from "@/components/ShowCard";
import { CATEGORIES } from "@/lib/format";
import type { ShowWithSeller } from "@/lib/types";

export default function LiveGrid({ shows }: { shows: ShowWithSeller[] }) {
  const [cat, setCat] = useState<string>("alle");
  const used = CATEGORIES.filter((c) => shows.some((s) => s.category === c.key));
  const visible = cat === "alle" ? shows : shows.filter((s) => s.category === cat);
  return (
    <>
      {used.length > 1 ? (
        <div className="filters" role="group" aria-label="Filtrér efter kategori">
          <button className="fchip" type="button" aria-pressed={cat === "alle"} onClick={() => setCat("alle")}>
            Alle
          </button>
          {used.map((c) => (
            <button key={c.key} className="fchip" type="button" aria-pressed={cat === c.key} onClick={() => setCat(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="cards grid-wrap">
        {visible.map((s, i) => (
          <ShowCard key={s.id} show={s} priority={i < 4} />
        ))}
      </div>
    </>
  );
}
