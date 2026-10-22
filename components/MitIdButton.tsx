/**
 * Knap til MitID hos Idura. Teksten følger MitID's retningslinjer ("… med MitID").
 * Vil I bruge MitID's officielle knap med logo, kan den hentes fra MitID's side for tjenesteudbydere og sættes ind her.
 */
export default function MitIdButton({ next, label = "Bekræft med MitID", className = "btn btn-red" }: { next: string; label?: string; className?: string }) {
  return (
    <a className={`${className} mitid-btn`} href={`/api/mitid/start?next=${encodeURIComponent(next)}`}>
      {label}
    </a>
  );
}
