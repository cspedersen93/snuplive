"use client";

import { useEffect, useState } from "react";
import { IconBell } from "@/components/Icons";
import { disablePush, enablePush, pushState, pushSupport, syncPush, type PushState, type PushSupport } from "@/lib/pushClient";
import { toast } from "@/lib/toast";

const NO_KEY = "relived-push-nej";

function said(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function remember(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Det gør ikke noget
  }
}

/** Efter "Følg": tilbud om besked på telefonen (vises kun, hvis det giver mening på enheden). */
export function PushOffer({ handle }: { handle: string }) {
  const [mode, setMode] = useState<"hidden" | "ask" | "ios">("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (said(NO_KEY)) return;
    const s = pushSupport();
    if (s === "ios-install") return setMode("ios");
    if (s !== "yes" || Notification.permission === "denied") return;
    pushState().then((st) => st === "off" && setMode("ask"));
  }, []);

  if (mode === "hidden") return null;

  async function yes() {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    setMode("hidden");
    toast(
      r === "on"
        ? "Du får besked på telefonen, når sælgere, du følger, går live."
        : r === "denied"
          ? "Beskeder er ikke slået til. Du får en mail i stedet."
          : "Det virkede ikke lige nu. Du får en mail i stedet.",
    );
  }

  function no() {
    remember(NO_KEY);
    setMode("hidden");
  }

  return (
    <div className="push-offer" role="status">
      <IconBell width={18} height={18} />
      {mode === "ask" ? (
        <div>
          <p>Vil du have besked på telefonen, når @{handle} går live? Ellers får du en mail.</p>
          <div className="push-offer-btns">
            <button className="btn btn-red btn-sm" type="button" onClick={yes} disabled={busy}>
              Ja tak
            </button>
            <button className="linkbtn" type="button" onClick={no}>
              Nej, mail er fint
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p>
            Vil du have besked på din iPhone, når @{handle} går live? Tryk på <b>Del</b> og <b>Føj til hjemmeskærm</b>, og åbn Relived
            derfra. Indtil da får du en mail.
          </p>
          <div className="push-offer-btns">
            <button className="linkbtn" type="button" onClick={no}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Min konto: slå besked på telefonen til eller fra på den enhed, man sidder med. */
export function PushToggle() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s === "yes")
      pushState().then((st) => {
        setState(st);
        if (st === "on") void syncPush();
      });
  }, []);

  if (!support) return null;

  async function toggle() {
    setBusy(true);
    if (state === "on") {
      await disablePush();
      setState("off");
      toast("Besked på telefonen er slået fra på denne enhed. Du får en mail i stedet.");
    } else {
      const r = await enablePush();
      setState(r === "on" ? "on" : r === "denied" ? "denied" : "off");
      toast(r === "on" ? "Besked på telefonen er slået til." : r === "denied" ? "Browseren tillader ikke beskeder fra Relived." : "Det virkede ikke lige nu. Prøv igen.");
    }
    setBusy(false);
  }

  return (
    <div className="push-toggle">
      <div>
        <strong>Besked på telefonen</strong>
        <p className="muted">
          {support === "ios-install"
            ? "På iPhone og iPad: tryk på Del og Føj til hjemmeskærm, og åbn Relived derfra. Så kan du slå beskeder til her."
            : support === "no"
              ? "Din browser kan ikke vise beskeder. Du får en mail i stedet."
              : state === "denied"
                ? "Du har blokeret beskeder fra Relived i browseren. Slå dem til i browserens indstillinger for siden."
                : state === "on"
                  ? "Slået til på denne enhed. Du får besked her, når sælgere, du følger, går live."
                  : "Få besked her, når sælgere, du følger, går live. Ellers får du en mail."}
        </p>
      </div>
      {support === "yes" && state !== "denied" && state !== null ? (
        <button className={`btn ${state === "on" ? "btn-line" : "btn-red"} btn-sm`} type="button" onClick={toggle} disabled={busy}>
          {state === "on" ? "Slå fra" : "Slå til"}
        </button>
      ) : null}
    </div>
  );
}
