import { reuseText } from "@/lib/reuse";

/** Linjen med genbrugstælleren (forsiden og Om Relived). Kun når der er et tal (lib/reuse.ts). */
export default function ReuseCounter({ n, className = "" }: { n: number | null; className?: string }) {
  if (n === null) return null;
  return (
    <p className={`reuse ${className}`.trim()}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v5h-5" />
      </svg>
      <span>{reuseText(n)}</span>
    </p>
  );
}
