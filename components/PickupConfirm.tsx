"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck } from "@/components/Icons";
import { errorText, toast } from "@/lib/toast";

type Role = "buyer" | "seller";
type Marks = { buyer: boolean; seller: boolean };

/** Mens køber og sælger står sammen, spørges serveren tit. Derefter sjældnere, og til sidst slet ikke. */
const FAST_MS = 4000;
const SLOW_MS = 30000;
const FAST_FOR = 3 * 60e3;
const STOP_AFTER = 15 * 60e3;

const DONE: Record<Role, string> = {
  buyer: "I har begge bekræftet. Handlen er afsluttet, og sælgeren får pengene.",
  seller: "I har begge bekræftet. Handlen er afsluttet, og pengene bliver sendt til dig.",
};
const WAIT: Record<Role, string> = {
  buyer: "Du har bekræftet. Nu mangler sælgeren.",
  seller: "Du har bekræftet. Nu mangler køberen.",
};

/**
 * Afhentning (0041_afhentning.sql): køber og sælger bekræfter begge, mens de står sammen, og først derefter
 * afsluttes handlen. Den samme boks vises hos køberen (Mine køb) og hos sælgeren (studiet). Den viser, hvem der
 * har bekræftet, og spørger serveren med få sekunders mellemrum, så den ene kan se, når den anden har trykket.
 */
export default function PickupConfirm({
  orderId,
  role,
  count,
  buyer,
  seller,
  locked = false,
}: {
  orderId: string;
  role: Role;
  /** Antal varer på ordren ("varen" eller "varerne"). */
  count: number;
  /** Har køberen og sælgeren bekræftet, da siden blev hentet? */
  buyer: boolean;
  seller: boolean;
  /** Køberen har meldt et problem: sælgeren kan ikke bekræfte, før sagen er afgjort. */
  locked?: boolean;
}) {
  const router = useRouter();
  // Det, serveren har svaret, siden siden blev hentet. Lægges oven i det, siden selv kom med.
  const [seen, setSeen] = useState<Marks>({ buyer: false, seller: false });
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = useRef(0);
  const finished = useRef(false);

  const finish = useCallback(
    (text?: string) => {
      if (finished.current) return;
      finished.current = true;
      if (text) toast(text);
      router.refresh();
    },
    [router],
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    active.current = Date.now();
    async function tick() {
      if (stopped || finished.current) return;
      const idle = Date.now() - active.current;
      if (document.visibilityState === "visible" && idle < STOP_AFTER) {
        try {
          const r = await fetch(`/api/orders/${orderId}/pickup`, { cache: "no-store" });
          if (r.ok && !stopped) {
            const j = (await r.json()) as { status: string; buyer: boolean; seller: boolean; done: boolean };
            if (j.done) return finish(DONE[role]);
            // Ordren er refunderet eller ændret et andet sted: hent siden igen.
            if (j.status !== "paid") return finish();
            setSeen((s) => (s.buyer === j.buyer && s.seller === j.seller ? s : { buyer: j.buyer, seller: j.seller }));
          }
        } catch {
          // Ingen forbindelse lige nu. Næste forsøg kommer om lidt.
        }
      }
      if (!stopped) timer = setTimeout(tick, Date.now() - active.current < FAST_FOR ? FAST_MS : SLOW_MS);
    }
    timer = setTimeout(tick, FAST_MS);
    const wake = () => {
      if (document.visibilityState !== "visible") return;
      active.current = Date.now();
      clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [orderId, role, finish]);

  async function confirm() {
    setBusy(true);
    active.current = Date.now();
    try {
      const r = await fetch(`/api/orders/${orderId}/pickup`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string; buyer?: boolean; seller?: boolean; done?: boolean };
      if (!r.ok) throw new Error(j.error || "Det lykkedes ikke.");
      if (j.done) finish(DONE[role]);
      else {
        setSeen({ buyer: Boolean(j.buyer), seller: Boolean(j.seller) });
        toast(WAIT[role]);
      }
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
      setAsk(false);
    }
  }

  const has: Marks = { buyer: buyer || seen.buyer, seller: seller || seen.seller };
  const me = has[role];
  const them = role === "buyer" ? has.seller : has.buyer;
  const it = count === 1 ? "varen" : "varerne";
  const otherName = role === "buyer" ? "Sælgeren" : "Køberen";

  return (
    <div className="pickup-box" role="group" aria-label="Bekræft afhentning" data-order={orderId}>
      <b>Bekræft afhentningen sammen</b>
      <span className="fine">
        {role === "buyer"
          ? `I bekræfter begge, mens du står hos sælgeren med ${it}. Først derefter får sælgeren pengene.`
          : `I bekræfter begge, mens køberen står hos dig med ${it}. Først derefter bliver pengene sendt til dig.`}
      </span>
      <ul className="pickup-marks" aria-live="polite">
        <li className={me ? "is-on" : undefined}>
          <span className="pickup-dot" aria-hidden="true">{me ? <IconCheck /> : null}</span>
          {me ? "Du har bekræftet" : "Du har ikke bekræftet endnu"}
        </li>
        <li className={them ? "is-on" : undefined}>
          <span className="pickup-dot" aria-hidden="true">{them ? <IconCheck /> : null}</span>
          {otherName} {them ? "har bekræftet" : "har ikke bekræftet endnu"}
        </li>
      </ul>
      {me ? (
        <span className="fine">
          {role === "buyer" ? "Bed sælgeren bekræfte på ordren i sit studie, før du går." : "Bed køberen bekræfte på ordren under Mine køb, før I går hver til sit."}
        </span>
      ) : locked ? (
        <span className="fine">Køberen har meldt et problem. Afhentningen kan først bekræftes, når Relived har kigget på sagen.</span>
      ) : ask ? (
        <div className="pickup-ask">
          <p className="pickup-warn" role="alert">
            {role === "buyer"
              ? `Har du fået ${it}, og er ${count === 1 ? "den" : "de"} som vist? Når I begge har bekræftet, er handlen afsluttet, og sælgeren får pengene. Bekræftelsen kan ikke trækkes tilbage.`
              : `Har køberen fået ${it}? Når I begge har bekræftet, er handlen afsluttet, og pengene bliver sendt til dig. Bekræftelsen kan ikke trækkes tilbage.`}
          </p>
          <div className="pickup-btns">
            <button className="btn btn-ivory btn-sm" type="button" onClick={confirm} disabled={busy}>
              {busy ? "Et øjeblik …" : role === "buyer" ? `Ja, jeg har fået ${it}` : `Ja, køberen har fået ${it}`}
            </button>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(false)} disabled={busy}>
              Fortryd
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-ivory btn-sm"
          type="button"
          onClick={() => {
            active.current = Date.now();
            setAsk(true);
          }}
        >
          Bekræft afhentning
        </button>
      )}
    </div>
  );
}
