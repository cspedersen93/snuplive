import Link from "next/link";
import { BadgeIcon, LevelChip } from "@/components/Level";
import { BADGES, BADGE_ORDER, LEVEL_NAME, nextStep, type BadgeKey, type LevelProgress, type Role } from "@/lib/levels";
import HideLevel from "./HideLevel";

/** Hvor langt man er til et mærke, der kræver et antal. */
function badgeCount(k: BadgeKey, p: LevelProgress): string | null {
  if (k === "lynafsender") return `${Math.min(p.fast_shipped, 10)}/10`;
  if (k === "budkonge") return `${Math.min(p.auctions_won, 10)}/10`;
  if (k === "stamkunde") return `${Math.min(p.best_repeat, 3)}/3`;
  return null;
}

function LevelCard({ p, role }: { p: LevelProgress; role: Role }) {
  const level = role === "seller" ? (p.seller_level ?? "ny") : p.buyer_level;
  const step = nextStep(p, role);
  const what = role === "seller" ? "solgte varer" : "købte varer";
  return (
    <div className="lvl-card" data-role={role}>
      <span className="k">Som {role === "seller" ? "sælger" : "køber"}</span>
      <strong>
        <LevelChip level={level} role={role} full showNew />
        {role === "buyer" && p.hide_buyer_level ? <span className="muted" style={{ fontSize: ".8125rem", fontWeight: 400 }}>Skjult for andre</span> : null}
      </strong>
      {step ? (
        <>
          <div className="lvl-bar" role="progressbar" aria-label={`Til ${LEVEL_NAME[step.next]}`} aria-valuemin={0} aria-valuemax={step.need} aria-valuenow={step.have}>
            <span style={{ width: `${Math.round((step.have / step.need) * 100)}%` }} />
          </div>
          <p>
            {step.have} af {step.need} {what} til {LEVEL_NAME[step.next]}.
          </p>
          {step.extra.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </>
      ) : (
        <p>Du er på det højeste niveau. Tak, fordi du er med!</p>
      )}
    </div>
  );
}

/** Min konto: ens niveauer, hvor langt der er til det næste, og mærkerne (0032_niveauer.sql). */
export default function LevelBox({ p, uid }: { p: LevelProgress; uid: string }) {
  const seller = p.seller_level !== null;
  const keys = BADGE_ORDER.filter((k) => seller || BADGES[k].role === "buyer");
  return (
    <div className="box" id="niveau">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "4px 14px" }}>
        <h2 className="h3">Dit niveau</h2>
        <Link href="/niveauer" style={{ fontSize: ".875rem" }}>Sådan virker niveauerne</Link>
      </div>
      <p className="muted" style={{ fontSize: ".9375rem", marginTop: 4 }}>
        Niveauet stiger, når dine handler er afsluttet, altså når køberen har fået varen. Alle kan se niveauet ved dit navn.
      </p>
      <div className="lvl-cols">
        {seller ? <LevelCard p={p} role="seller" /> : null}
        <LevelCard p={p} role="buyer" />
      </div>
      <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>Dine mærker</h3>
      <ul className="mrks" aria-label="Dine mærker">
        {keys.map((k) => {
          const have = p.badges.includes(k);
          const count = have ? null : badgeCount(k, p);
          return (
            <li key={k} className={`mrk mrk-${k}${have ? "" : " locked"}`} title={BADGES[k].text}>
              <BadgeIcon k={k} />
              {BADGES[k].name}
              {count ? <small>{count}</small> : null}
              <span className="sr-only">{have ? "(har du)" : `(mangler: ${BADGES[k].text})`}</span>
            </li>
          );
        })}
      </ul>
      <HideLevel uid={uid} hidden={p.hide_buyer_level} />
    </div>
  );
}
