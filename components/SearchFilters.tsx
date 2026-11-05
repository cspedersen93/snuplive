"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/format";
import { CONDS, SELLERS, SORTS, TYPES, WHENS, filterCount, hasSizeFilter, searchHref, type Search } from "@/lib/search";

/**
 * Filtrene under søgefeltet på /soeg. Det er stadig en almindelig GET-formular (virker uden JavaScript).
 * Med JavaScript: lister og afkrydsninger søger med det samme, størrelsen vises kun ved tøj og sko,
 * og på mobilen ligger filtrene bag knappen "Filtre".
 */
export default function SearchFilters({ s }: { s?: Partial<Search> }) {
  const panel = useRef<HTMLDivElement>(null);
  const [cat, setCat] = useState(s?.category ?? null);
  const [open, setOpen] = useState(false);
  const count = filterCount(s ?? {});
  const catSlug = CATEGORIES.find((c) => c.key === s?.category)?.slug ?? "";

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const onChange = (e: Event) => {
      const t = e.target as HTMLElement;
      // Tekstfelter (størrelse og pris) søger først, når man trykker Enter eller Søg.
      if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type === "checkbox")) {
        t.form?.requestSubmit();
      }
    };
    // Tomme felter kommer ikke med i adressen (så den bliver /soeg?q=kjole&stand=god og ikke en lang liste).
    const form = el.closest("form");
    const onSubmit = () => {
      if (!form) return;
      const empty = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name], select[name]")].filter(
        (f) => !f.disabled && f.value === "" && f.name !== "q",
      );
      for (const f of empty) f.disabled = true;
      setTimeout(() => empty.forEach((f) => (f.disabled = false)), 0);
    };
    el.addEventListener("change", onChange);
    form?.addEventListener("submit", onSubmit);
    return () => {
      el.removeEventListener("change", onChange);
      form?.removeEventListener("submit", onSubmit);
    };
  }, []);

  const showSize = hasSizeFilter(cat);
  return (
    <>
      <button
        className={`btn btn-line btn-sm sf-toggle${count ? " has" : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls="sf-panel"
        onClick={() => setOpen((o) => !o)}
      >
        Filtre{count ? ` (${count})` : ""}
      </button>
      <div className={`sf-panel${open ? " open" : ""}`} id="sf-panel" ref={panel}>
        <div className="field">
          <label htmlFor="sf-kat">Kategori</label>
          <select
            id="sf-kat"
            name="kategori"
            defaultValue={catSlug}
            onChange={(e) => setCat(CATEGORIES.find((c) => c.slug === e.target.value)?.key ?? null)}
          >
            <option value="">Alle</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </div>
        {showSize ? (
          <div className="field">
            <label htmlFor="sf-str">Str. (tøj og sko)</label>
            <input id="sf-str" name="str" defaultValue={s?.size ?? ""} maxLength={20} placeholder="Fx M eller 92" />
          </div>
        ) : null}
        <div className="field sf-price">
          <span className="sf-label" id="sf-pris">Pris (kr)</span>
          <div className="sf-pair" role="group" aria-labelledby="sf-pris">
            <input name="fra" inputMode="numeric" defaultValue={s?.min ?? ""} placeholder="Fra" aria-label="Pris fra (kr)" />
            <span aria-hidden="true">–</span>
            <input name="maks" inputMode="numeric" defaultValue={s?.maxPrice ?? ""} placeholder="Til" aria-label="Pris til (kr)" />
          </div>
        </div>
        <div className="field sf-wide">
          <label htmlFor="sf-stand">Stand</label>
          <select id="sf-stand" name="stand" defaultValue={s?.stand ?? ""}>
            <option value="">Alle</option>
            {CONDS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sf-hvornaar">Hvornår</label>
          <select id="sf-hvornaar" name="hvornaar" defaultValue={s?.hvornaar ?? ""}>
            <option value="">Alle</option>
            {WHENS.map((w) => (
              <option key={w.key} value={w.key}>{w.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sf-type">Købsform</label>
          <select id="sf-type" name="type" defaultValue={s?.type ?? ""}>
            <option value="">Alle</option>
            {TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sf-saelger">Sælger</label>
          <select id="sf-saelger" name="saelger" defaultValue={s?.saelger ?? ""}>
            <option value="">Alle</option>
            {SELLERS.map((x) => (
              <option key={x.key} value={x.key}>{x.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sf-sorter">Sortér</label>
          <select id="sf-sorter" name="sorter" defaultValue={s?.sort && s.sort !== "anbefalet" ? s.sort : ""}>
            {SORTS.map((x) => (
              <option key={x.key} value={x.key === "anbefalet" ? "" : x.key}>{x.label}</option>
            ))}
          </select>
        </div>
        <div className="sf-checks">
          <label className="check">
            <input type="checkbox" name="aegthed" value="1" defaultChecked={Boolean(s?.aegthed)} />
            <span>Ægthed tjekket</span>
          </label>
          <label className="check">
            <input type="checkbox" name="video" value="1" defaultChecked={Boolean(s?.video)} />
            <span>Med video</span>
          </label>
        </div>
        <div className="sf-actions">
          <button className="btn btn-red btn-sm" type="submit">Vis varer</button>
          {count || s?.category ? (
            <Link className="linkbtn" href={searchHref({ q: s?.q ?? "", category: null, maxPrice: null, size: null })}>
              Nulstil filtre
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
