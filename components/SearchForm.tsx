import { IconSearch } from "@/components/Icons";
import { CATEGORIES } from "@/lib/format";
import type { Search } from "@/lib/search";
import SearchFilters from "@/components/SearchFilters";

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
      {compact ? (cat ? <input type="hidden" name="kategori" value={cat.slug} /> : null) : <SearchFilters s={s} />}
    </form>
  );
}
