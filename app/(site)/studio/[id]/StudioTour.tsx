"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconBlurBg, IconFlip, IconMic, IconSun } from "@/components/Icons";
import { TOUR_KEYS } from "@/lib/cookies";

// Rundvisning i studiet: én ting ad gangen bliver fremhævet med en kort forklaring og OK.
// Første gang spørger vi, om sælgeren vil se den. Svarer man Nej tak, kommer den ikke igen (men kan altid startes
// under "Rundvisning" øverst i studiet). Valget huskes i browseren.

type Step = {
  /** data-tour på det, der skal fremhæves. Uden: en boks midt på skærmen. Findes det ikke på siden, springes trinnet over. */
  target?: string;
  title: string;
  body: React.ReactNode;
};

function hostSteps(): Step[] {
  return [
    {
      target: "queue",
      title: "Køen",
      body: (
        <p>
          Her står de ting, du vil vise i showet, i den rækkefølge, du viser dem. Tryk <b>Ret</b> for at ændre en ting eller
          <b> Fjern</b> for at tage den ud. Når du er live, viser du en bestemt ting med <b>Vis</b>.
        </p>
      ),
    },
    {
      target: "item-form",
      title: "Sæt en ting til salg",
      body: (
        <>
          <p>Sådan lægger du en ting i køen:</p>
          <ol>
            <li>Skriv, hvad det er, og sæt en pris.</li>
            <li>
              Vælg <b>Fast pris</b> (den første, der trykker Køb, får den) eller <b>Budsalg</b> (det højeste bud vinder).
            </li>
            <li>Skriv str. og stand. Under <b>+ Billeder, beskrivelse og kategori</b> kan du lægge billeder på, så købere kan finde den før showet.</li>
            <li>Tryk <b>Læg i køen</b>.</li>
          </ol>
        </>
      ),
    },
    {
      target: "player",
      title: "Kameraet",
      body: (
        <>
          <p>
            Tryk <b>Tænd kameraet</b>, og tjek billede og lyd. Ingen kan se dig, før du trykker <b>Gå live</b>. Når kameraet er
            tændt, har du knapper i højre side:
          </p>
          <ul className="tour-icons">
            <li><span><IconMic /></span>Slå mikrofonen fra og til</li>
            <li><span><IconFlip /></span>Skift mellem for- og bagkamera</li>
            <li><span><IconSun /></span>Lys op: et lysere billede</li>
            <li><span><IconBlurBg /></span>Slør baggrunden bag dig</li>
          </ul>
        </>
      ),
    },
    {
      target: "player",
      title: "Vises nu",
      body: (
        <p>
          Når du er live, står den ting, du viser, nederst på kameraet med prisen. <b>Swipe til venstre</b> for næste ting og
          <b> til højre</b> for den forrige. Seerne trykker Køb, og den første får tingen. Vi tager selv et billede og et kort
          klip af tingen, mens du viser den.
        </p>
      ),
    },
    {
      target: "ctrl",
      title: "Styr showet",
      body: (
        <ul>
          <li><b>Vis næste</b> viser den næste ting i køen.</li>
          <li><b>Lynrunde 10 s</b> giver seerne 10 sekunder til at købe tingen. Godt, når mange vil have den.</li>
          <li>Er tingen sat til budsalg, står der <b>Start budsalg</b> i stedet. Så har seerne 30 sekunder til at byde.</li>
          <li><b>Afslut show</b> stopper videoen for alle.</li>
        </ul>
      ),
    },
    {
      target: "ticker",
      title: "Dine tal",
      body: <p>Her kan du se, hvor mange der ser med, hvor mange ting du har solgt, og hvor meget du har solgt for.</p>,
    },
    {
      target: "chat",
      title: "Chatten",
      body: (
        <p>
          Seerne stiller spørgsmål her. Svar højt i kameraet, eller skriv selv. Tryk <b>⋯</b> ved en besked for at fjerne den
          eller blokere brugeren.
        </p>
      ),
    },
    {
      target: "guests",
      title: "Sælg sammen med andre",
      body: (
        <p>
          Tryk <b>Inviter en sælger</b>, og send linket. Op til 2 andre sælgere kan være med. I er på kameraet sammen, og hver
          får pengene for sine egne ting. Du styrer, hvad der vises.
        </p>
      ),
    },
    {
      target: "share",
      title: "Del dit show",
      body: <p>Kopiér linket, og del det, før du går live. Dine følgere får selv besked, når du går live.</p>,
    },
    {
      title: "Efter showet",
      body: (
        <>
          <p>
            Det, der ikke bliver solgt, kommer af sig selv <b>til salg til fast pris</b>, så det kan købes bagefter. Du kan rette
            prisen under <b>Mine shows → Til salg</b>. Når nogen køber, får du besked, og du finder fragtlabelen under Mine shows.
          </p>
          <p>Har du ikke lyst til at gå live, kan du også sælge med en video under <b>Mine shows → Sælg med video</b>.</p>
          <p className="tour-fine">Du kan altid se rundvisningen igen under <b>Rundvisning</b> øverst i studiet.</p>
        </>
      ),
    },
  ];
}

function guestSteps(host: string): Step[] {
  return [
    {
      target: "queue",
      title: "Køen",
      body: (
        <p>
          Her står både dine og @{host}s ting. Dine egne kan du rette og fjerne. Ved de andres står, hvem der sælger dem.
        </p>
      ),
    },
    {
      target: "item-form",
      title: "Sæt en ting til salg",
      body: (
        <>
          <p>Skriv, hvad det er, sæt en pris, og tryk <b>Læg i køen</b>. Vælg <b>Budsalg</b>, hvis det højeste bud skal vinde.</p>
          <p>Pengene for dine ting går til dig, og du sender dem selv.</p>
        </>
      ),
    },
    {
      target: "player",
      title: "Dit kamera",
      body: (
        <>
          <p>
            Tryk <b>Tænd kameraet</b>, og tjek billede og lyd. Når en af dine ting bliver vist, er det dit kamera, seerne ser. Hold
            tingen tæt på kameraet. Knapperne i højre side:
          </p>
          <ul className="tour-icons">
            <li><span><IconMic /></span>Slå mikrofonen fra og til</li>
            <li><span><IconFlip /></span>Skift mellem for- og bagkamera</li>
            <li><span><IconSun /></span>Lys op: et lysere billede</li>
            <li><span><IconBlurBg /></span>Slør baggrunden bag dig</li>
          </ul>
        </>
      ),
    },
    {
      target: "ctrl",
      title: `@${host} styrer showet`,
      body: <p>Værten går live, viser tingene frem og starter budsalg og lynrunder. Du kan se her, hvad du har solgt.</p>,
    },
    {
      target: "chat",
      title: "Chatten",
      body: <p>Seerne stiller spørgsmål her. Dine beskeder bliver fremhævet, så seerne kan se, at du sælger med.</p>,
    },
    {
      target: "guests",
      title: "Hvem er med",
      body: (
        <p>
          Her kan du se, hvem der er med i showet. Vil du gå, så tryk <b>Forlad showet</b>. Dine ting i køen kommer til salg,
          når showet slutter.
        </p>
      ),
    },
    {
      title: "Klar",
      body: (
        <>
          <p>Det, du ikke sælger i showet, kommer af sig selv til salg til fast pris under <b>Mine shows → Til salg</b>.</p>
          <p className="tour-fine">Du kan altid se rundvisningen igen under <b>Rundvisning</b> øverst i studiet.</p>
        </>
      ),
    },
  ];
}

const PAD = 8;

export default function StudioTour({
  role,
  host,
  auto,
  replay,
}: {
  role: "host" | "guest";
  host: string;
  /** Spørg første gang (kun før showet, så et live-show ikke bliver forstyrret). */
  auto: boolean;
  /** Tæller, der starter rundvisningen forfra, når den skifter (knappen Rundvisning). */
  replay: number;
}) {
  const key = role === "host" ? TOUR_KEYS.host : TOUR_KEYS.guest;
  const [steps, setSteps] = useState<Step[]>([]);
  // -1: spørgsmålet først. null: lukket.
  const [at, setAt] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const card = useRef<HTMLDivElement>(null);
  const okBtn = useRef<HTMLButtonElement>(null);

  const build = useCallback(() => {
    const all = role === "host" ? hostSteps() : guestSteps(host);
    // Kun de trin, hvis knap eller boks findes på siden lige nu.
    return all.filter((s) => !s.target || document.querySelector(`[data-tour="${s.target}"]`));
  }, [role, host]);

  const remember = useCallback(
    (v: "nej" | "set") => {
      try {
        localStorage.setItem(key, v);
      } catch {
        // Browseren gemmer ikke noget. Så spørger vi bare igen næste gang.
      }
    },
    [key],
  );

  // Første gang: spørg, om sælgeren vil se rundvisningen.
  useEffect(() => {
    if (!auto || navigator.webdriver) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(key);
    } catch {
      seen = "set";
    }
    if (seen) return;
    const t = setTimeout(() => {
      setSteps(build());
      setAt(-1);
    }, 700);
    return () => clearTimeout(t);
  }, [auto, key, build]);

  // Knappen Rundvisning: start forfra (uden spørgsmålet).
  useEffect(() => {
    if (!replay) return;
    setSteps(build());
    setAt(0);
  }, [replay, build]);

  const step = at !== null && at >= 0 ? steps[at] : null;
  const target = step?.target ?? null;

  // Find det, der skal fremhæves, og rul det ind på skærmen.
  useLayoutEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (!el) return setRect(null);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setRect(el.getBoundingClientRect()));
    };
    measure();
    const late = setTimeout(measure, 450);
    const later = setTimeout(measure, 1000);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("scrollend", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(late);
      clearTimeout(later);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("scrollend", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [target, at]);

  // Placér boksen under eller over det fremhævede (eller nederst på skærmen, hvis der ikke er plads).
  useLayoutEffect(() => {
    if (!rect || !card.current) return setPos({});
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(380, vw - 32);
    const h = card.current.offsetHeight;
    const left = Math.max(16, Math.min(vw - w - 16, rect.left + rect.width / 2 - w / 2));
    // Boksen bliver altid inde på skærmen, også mens siden ruller hen til det, der fremhæves.
    const clamp = (top: number) => Math.max(12, Math.min(vh - h - 12, top));
    if (rect.bottom + PAD + 12 + h <= vh - 12) setPos({ top: clamp(rect.bottom + PAD + 12), left, width: w });
    else if (rect.top - PAD - 12 - h >= 12) setPos({ top: clamp(rect.top - PAD - 12 - h), left, width: w });
    else setPos({ bottom: 16, left, width: w });
  }, [rect, at]);

  // Fokus på OK, og Escape lukker.
  useEffect(() => {
    if (at === null) return;
    okBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close er stabil nok her (den lukker bare).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  function close() {
    remember("set");
    setAt(null);
  }
  function no() {
    remember("nej");
    setAt(null);
  }
  function next() {
    if (at === null) return;
    if (at + 1 >= steps.length) return close();
    setAt(at + 1);
  }

  if (at === null) return null;

  if (at === -1) {
    return (
      <div className="tour-layer">
        <div className="tour-dim" />
        <div className="tour-card center" role="dialog" aria-modal="true" aria-labelledby="tour-t">
          <span className="label red">Rundvisning</span>
          <h2 id="tour-t">{role === "host" ? "Vil du se, hvordan studiet virker?" : `Du er gæst hos @${host}. Vil du se, hvordan det virker?`}</h2>
          <p>
            Vi viser dig på et minut, hvad knapperne gør, og hvordan du sætter dine ting til salg. Du trykker bare OK for at gå
            videre.
          </p>
          <div className="tour-btns">
            <button ref={okBtn} className="btn btn-red" type="button" onClick={() => setAt(0)}>Ja, vis mig</button>
            <button className="btn btn-line" type="button" onClick={no}>Nej tak</button>
          </div>
          <p className="tour-fine">Du kan altid se den senere under <b>Rundvisning</b> øverst i studiet.</p>
        </div>
      </div>
    );
  }

  if (!step) return null;
  const last = at + 1 >= steps.length;
  return (
    <div className="tour-layer">
      {rect ? (
        <div
          className="tour-spot"
          aria-hidden="true"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div
        ref={card}
        className={`tour-card${rect ? "" : " center"}`}
        style={rect ? pos : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-t"
      >
        <span className="tour-count">
          {at + 1} af {steps.length}
        </span>
        <h2 id="tour-t">{step.title}</h2>
        <div className="tour-body">{step.body}</div>
        <div className="tour-btns">
          <button ref={okBtn} className="btn btn-red btn-sm" type="button" onClick={next}>
            {last ? "Færdig" : "OK"}
          </button>
          {at > 0 ? (
            <button className="btn btn-line btn-sm" type="button" onClick={() => setAt(at - 1)}>Tilbage</button>
          ) : null}
          {!last ? (
            <button className="linkbtn" type="button" onClick={close}>Spring resten over</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
