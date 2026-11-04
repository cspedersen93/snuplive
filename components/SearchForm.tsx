import { IconSearch } from "@/components/Icons";
import { CATEGORIES } from "@/lib/format";
import type { Search } from "@/lib/search";

/** Søgefeltet (et almindeligt GET-formular til /soeg, så det virker uden JavaScript). */
export default function SearchForm({ s, compact = false, autoFocus = false }: { s?: Partial<Search>; compact?: boolean; autoFocus?: boolean }) {
  const cat = CATEGORIES.find((c) => c.key === s?.category);
  return (
    <form className={compact ? "search-form compact" : "search-form"} action="/soeg" method="get" role="search">
      <div className="search-main">
        <label className="sr-only" htmlFor={compact ? "sf-q-c" : "sf-q"}>Søg</label>
        <IconSearch aria-hidden="true" />
        <input
          id={compact ? "sf-q-c" : "sf-q"}
          name="q"
          type="search"
          defaultValue={s?.q ?? ""}
          placeholder="Søg fx uldfrakke, Kähler eller LEGO"
          maxLength={60}
          enterKeyHint="search"
          autoFocus={autoFocus}
        />
        <button className="btn btn-red btn-sm" type="submit">Søg</button>
      </div>
      {compact ? (cat ? <input type="hidden" name="kategori" value={cat.slug} /> : null) : (
        <div className="search-more">
          <div className="field">
            <label htmlFor="sf-kat">Kategori</label>
            <select id="sf-kat" name="kategori" defaultValue={cat?.slug ?? ""}>
              <option value="">Alle</option>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sf-str">Str. (tøj og sko)</label>
            <input id="sf-str" name="str" defaultValue={s?.size ?? ""} maxLength={20} placeholder="Fx M eller 92" />
          </div>
          <div className="field">
            <label htmlFor="sf-maks">Maks pris (kr)</label>
            <input id="sf-maks" name="maks" inputMode="numeric" defaultValue={s?.maxPrice ?? ""} placeholder="Fx 500" />
          </div>
        </div>
      )}
    </form>
  );
}
