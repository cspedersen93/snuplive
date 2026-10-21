/** Sælgerens gennemsnit, fx "★ 4,8 (12)". Vises ikke, før der er en bedømmelse. */
export default function Stars({ avg, count, className = "" }: { avg?: number | string | null; count?: number | null; className?: string }) {
  if (!count || avg == null) return null;
  const v = Number(avg).toLocaleString("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <span className={`stars-sum ${className}`} aria-label={`${v} ud af 5 stjerner, ${count} ${count === 1 ? "bedømmelse" : "bedømmelser"}`}>
      <span aria-hidden="true">★</span> {v} <span className="muted">({count})</span>
    </span>
  );
}
