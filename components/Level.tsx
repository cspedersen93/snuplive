import { BADGES, BADGE_ORDER, LEVEL_NAME, levelNeeds, levelTitle, type BadgeKey, type Level, type Role } from "@/lib/levels";

/**
 * Niveau-mærket ved navnet (Bronze, Sølv, Guld, VIP). "Ny" vises ikke andre steder end på Min konto,
 * så chatten ikke fyldes op. full = "Guld-sælger" i stedet for bare "Guld".
 */
export function LevelChip({ level, role, full = false, showNew = false }: { level: Level | null | undefined; role: Role; full?: boolean; showNew?: boolean }) {
  if (!level || (level === "ny" && !showNew)) return null;
  const title = `${levelTitle(level, role)}: ${levelNeeds(level, role)}`;
  return (
    <span className={`lvl lvl-${level}`} title={title}>
      {level === "vip" ? <BadgeIcon k="vip" /> : null}
      {full ? levelTitle(level, role) : LEVEL_NAME[level]}
    </span>
  );
}

/** Mærkerne som små piller med ikon. role begrænser til sælger- eller købermærker. */
export function BadgeList({ badges, role, className = "" }: { badges: BadgeKey[] | null | undefined; role?: Role; className?: string }) {
  const list = BADGE_ORDER.filter((k) => badges?.includes(k) && (!role || BADGES[k].role === role));
  if (!list.length) return null;
  return (
    <ul className={`mrks ${className}`.trim()} aria-label="Mærker">
      {list.map((k) => (
        <li key={k} className={`mrk mrk-${k}`} title={BADGES[k].text}>
          <BadgeIcon k={k} />
          {BADGES[k].name}
        </li>
      ))}
    </ul>
  );
}

/** Små ikoner tegnet med streg, så de passer til resten af siden. */
export function BadgeIcon({ k }: { k: BadgeKey | "vip" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let d: React.ReactNode;
  switch (k) {
    case "vip":
    case "budkonge":
      d = <path {...p} d="M2.5 12.5h11M3 11 2 4.5l3.5 3L8 3l2.5 4.5L14 4.5 13 11z" />;
      break;
    case "stiftende_saelger":
    case "stiftende_koeber":
      d = <path {...p} d="M8 2.2l1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 11l-3.5 1.9.8-3.9-2.9-2.7 3.9-.5z" />;
      break;
    case "foerste_koeb":
      d = <path {...p} d="M3.5 5.5h9l-.8 8h-7.4zM6 5.5V4.5a2 2 0 0 1 4 0v1" />;
      break;
    case "foerste_show":
      d = (
        <>
          <circle cx="8" cy="8" r="2.2" fill="currentColor" />
          <path {...p} d="M4.2 4.2a5.4 5.4 0 0 0 0 7.6M11.8 4.2a5.4 5.4 0 0 1 0 7.6" />
        </>
      );
      break;
    case "lynafsender":
      d = <path {...p} d="M9 1.8 3.8 9h4l-1 5.2L12.2 7h-4z" />;
      break;
    case "stamkunde":
      d = <path {...p} d="M8 13.3S2.5 10 2.5 6.2A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.2C13.5 10 8 13.3 8 13.3z" />;
      break;
    case "natteravn":
      d = <path {...p} d="M12.8 10.2A5.3 5.3 0 0 1 5.8 3.2a5.3 5.3 0 1 0 7 7z" />;
      break;
  }
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      {d}
    </svg>
  );
}
