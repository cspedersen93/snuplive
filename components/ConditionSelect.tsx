import { AI_CONDITIONS } from "@/lib/aiListing";

/**
 * Standen på en vare: fem faste valg, så køberne kan filtrere på den i søgningen (0033_filtre.sql).
 * En vare med en gammel, fritskrevet stand beholder den som et ekstra valg.
 */
export default function ConditionSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const custom = value && !(AI_CONDITIONS as readonly string[]).includes(value) ? value : null;
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Vælg stand</option>
      {AI_CONDITIONS.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
      {custom ? <option value={custom}>{custom}</option> : null}
    </select>
  );
}
