"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { IconShield } from "@/components/Icons";
import { CARRIER_CODES, CARRIERS, distanceText, type CarrierCode, type Pakkeshop } from "@/lib/carriers";
import { kr } from "@/lib/format";
import { bundleDiscount, bundlePct, DELIVERY, nextBundle, orderAmounts, PARCELS, type BundleTiers, type Delivery, type Parcel } from "@/lib/pricing";
import { errorText, toast } from "@/lib/toast";

export interface PayGroup {
  key: string;
  seller: { handle: string; display_name: string | null; avatar_path: string | null };
  showTitle: string;
  deadline: string;
  items: { id: string; name: string; meta: string; price: number }[];
  /** Sælgerens samlerabat (0027_samlerabat.sql), hvis hun giver en. */
  bundle?: BundleTiers | null;
  /** Der er en cykel eller barnevogn i pakken: afhentning er valgt på forhånd. */
  pickup?: boolean;
  /** Pakkens størrelse ud fra varerne (lib/pricing.ts: parcelFor). Fragten følger den. */
  parcel: Parcel;
}

const MEMORY = "snuplive:pakkeshop";
const DAYS = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

/** "Man: 07:00-23:00" × 7 → "Åben alle dage 07:00-23:00", ellers dagens tider. */
function hoursText(hours: string[]) {
  if (!hours.length) return "";
  const times = hours.map((h) => h.replace(/^[^:]+:\s*/, "").trim());
  if (times.length >= 7 && times.every((t) => t === times[0])) return `Åben alle dage ${times[0]}`;
  const today = DAYS[new Date().getDay()];
  const line = hours.find((h) => h.toLowerCase().startsWith(today.toLowerCase()));
  return line ? `I dag ${line.replace(/^[^:]+:\s*/, "")}` : "";
}

export default function PayGroups({ groups, ready, pakkeshop }: { groups: PayGroup[]; ready: boolean; pakkeshop: boolean }) {
  const [choice, setChoice] = useState<Record<string, Delivery>>(() => Object.fromEntries(groups.map((g) => [g.key, g.pickup ? "pickup" : "ship"])));
  const [busy, setBusy] = useState(false);

  // Pakkeshop: fragtfirma, postnummer og valgt shop. Huskes i browseren til næste gang.
  const [carrier, setCarrier] = useState<CarrierCode>("dao");
  const [zip, setZip] = useState("");
  const [points, setPoints] = useState<Pakkeshop[]>([]);
  const [selected, setSelected] = useState<Pakkeshop | null>(null);
  const [rememberedId, setRememberedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const pickerRef = useRef<HTMLElement>(null);

  // Samme regnestykke som betalingen på serveren (app/api/checkout/route.ts), med samlerabat pr. sælger.
  const sums = groups.map((g) => {
    const gross = g.items.reduce((a, i) => a + i.price, 0);
    return orderAmounts(gross, choice[g.key] ?? "ship", bundleDiscount(gross, g.items.length, g.bundle), g.parcel);
  });
  const total = sums.reduce(
    (a, s) => ({
      gross: a.gross + s.gross,
      discount: a.discount + s.discount,
      shipping: a.shipping + s.shipping,
      fee: a.fee + s.fee,
      total: a.total + s.total,
    }),
    { gross: 0, discount: 0, shipping: 0, fee: 0, total: 0 },
  );
  const anyShip = groups.some((g) => (choice[g.key] ?? "ship") === "ship");
  const needShop = pakkeshop && anyShip;
  const missingShop = needShop && !selected;

  useEffect(() => {
    if (!pakkeshop) return;
    try {
      const saved = JSON.parse(localStorage.getItem(MEMORY) ?? "null") as { carrier?: string; zip?: string; id?: string } | null;
      if (saved && (saved.carrier === "dao" || saved.carrier === "gls")) setCarrier(saved.carrier);
      if (saved?.zip && /^[0-9]{4}$/.test(saved.zip)) setZip(saved.zip);
      if (saved?.id) setRememberedId(saved.id);
    } catch {
      // Ingen adgang til browserens lager. Køberen vælger bare igen.
    }
  }, [pakkeshop]);

  useEffect(() => {
    if (!needShop || !/^[0-9]{4}$/.test(zip)) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const r = await fetch(`/api/fragt/pakkeshops?fragt=${carrier}&postnr=${zip}`, { signal: ctl.signal });
        const j = (await r.json().catch(() => ({}))) as { points?: Pakkeshop[]; error?: string };
        if (!r.ok) throw new Error(j.error || "Vi kunne ikke hente pakkeshops.");
        const list = j.points ?? [];
        setPoints(list);
        setSelected((cur) => list.find((p) => p.id === cur?.id) ?? list.find((p) => p.id === rememberedId) ?? null);
        if (!list.length) setSearchError(`Vi fandt ingen ${CARRIERS[carrier].name}-pakkeshops ved ${zip}. Prøv et andet postnummer eller fragtfirma.`);
      } catch (e) {
        if (ctl.signal.aborted) return;
        setPoints([]);
        setSearchError(errorText(e));
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [needShop, carrier, zip, rememberedId]);

  function choose(p: Pakkeshop) {
    setSelected(p);
    try {
      localStorage.setItem(MEMORY, JSON.stringify({ carrier: p.carrier, zip, id: p.id }));
    } catch {
      // Ikke vigtigt
    }
  }

  async function pay() {
    if (missingShop) {
      toast("Vælg den pakkeshop, pakken skal sendes til.");
      pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deliveries: choice,
          pakkeshop: needShop && selected ? { carrier: selected.carrier, id: selected.id, zipcode: zip } : undefined,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Betalingen kunne ikke startes.");
      window.location.href = j.url;
    } catch (e) {
      setBusy(false);
      toast(errorText(e));
    }
  }

  return (
    <div className="cart-grid" style={{ paddingBlock: 0 }}>
      <div style={{ minWidth: 0 }}>
        {groups.map((g, gi) => (
          <section className="group" key={g.key} aria-label={`Fra ${g.seller.handle}`}>
            <div className="group-head">
              <div className="seller-row">
                <Avatar handle={g.seller.handle} path={g.seller.avatar_path} />
                <div>
                  <strong>{g.seller.handle}</strong>
                  <span className="muted" style={{ fontSize: ".875rem" }}>{g.showTitle}</span>
                </div>
              </div>
              <span className="chip warn">Betal senest {g.deadline}</span>
            </div>
            {g.items.map((i) => (
              <div className="citem" key={i.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{i.name}</strong>
                  {i.meta ? <span className="from">{i.meta}</span> : null}
                </div>
                <div className="right">
                  <span className="num" style={{ fontWeight: 600 }}>{kr(i.price)}</span>
                </div>
              </div>
            ))}
            {sums[gi].discount > 0 ? (
              <div className="citem bundle-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>Samlerabat {bundlePct(g.items.length, g.bundle)} %</strong>
                  <span className="from">Du køber {g.items.length} varer hos {g.seller.handle}</span>
                </div>
                <div className="right">
                  <span className="num" style={{ fontWeight: 600 }}>−{kr(sums[gi].discount)}</span>
                </div>
              </div>
            ) : null}
            {nextBundle(g.items.length, g.bundle) ? (
              <p className="bundle-hint">
                Køb {nextBundle(g.items.length, g.bundle)?.more === 1 ? "1 vare" : `${nextBundle(g.items.length, g.bundle)?.more} varer`} mere hos{" "}
                <a href={`/live/${g.seller.handle}`}>{g.seller.handle}</a>, og få {nextBundle(g.items.length, g.bundle)?.pct} % i samlerabat.
              </p>
            ) : null}
            <fieldset className="deliv">
              <legend>Levering</legend>
              {g.pickup ? (
                <p className="fine pickup-note">Cykler og barnevogne er for store til en pakkeshop, så de hentes hos sælgeren. Se varen efter, før du bekræfter, at du har fået den.</p>
              ) : null}
              <div className="opts">
                {(Object.keys(DELIVERY) as Delivery[]).map((d) => (
                  <label className="opt" key={d}>
                    <input
                      type="radio"
                      name={`lev-${gi}`}
                      checked={choice[g.key] === d}
                      onChange={() => setChoice((c) => ({ ...c, [g.key]: d }))}
                    />
                    <span>
                      <strong>{DELIVERY[d].label}</strong>
                      <small>
                        {d === "ship"
                          ? `${PARCELS[g.parcel].label} (${PARCELS[g.parcel].weight}). ${pakkeshop ? DELIVERY.ship.note : "Sælgeren sender pakken til en pakkeshop nær din adresse."}`
                          : DELIVERY[d].note}
                      </small>
                    </span>
                    <span className="num">{kr(d === "ship" ? PARCELS[g.parcel].price : DELIVERY[d].price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="group-foot">
              <span>Sendes i én pakke</span>
              <b>{kr(sums[gi].items + sums[gi].shipping)}</b>
            </div>
          </section>
        ))}

        {needShop ? (
          <section className="group pshop" ref={pickerRef} aria-labelledby="h-pshop">
            <div className="group-head">
              <div>
                <h2 className="h3" id="h-pshop" style={{ fontSize: "1rem" }}>Hvilken pakkeshop skal pakken til?</h2>
                <span className="muted" style={{ fontSize: ".875rem" }}>
                  {groups.length > 1 ? "Gælder alle pakker herover, der skal sendes." : "Du får besked fra fragtfirmaet, når pakken er klar."}
                </span>
              </div>
            </div>
            <div className="pshop-body">
              <div className="pshop-row">
                <fieldset className="seg">
                  <legend className="sr-only">Fragtfirma</legend>
                  {CARRIER_CODES.map((c) => (
                    <label key={c}>
                      <input
                        type="radio"
                        name="fragtfirma"
                        checked={carrier === c}
                        onChange={() => {
                          setCarrier(c);
                          setSelected(null);
                          setPoints([]);
                        }}
                      />
                      <span>{CARRIERS[c].name}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="field pshop-zip">
                  <label htmlFor="pshop-zip">Postnummer</label>
                  <input
                    id="pshop-zip"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={4}
                    placeholder="Fx 2650"
                    value={zip}
                    onChange={(e) => {
                      setZip(e.target.value.replace(/\D/g, "").slice(0, 4));
                      setSearchError("");
                    }}
                  />
                </div>
              </div>
              {loading ? <p className="muted" style={{ fontSize: ".875rem" }} role="status">Finder pakkeshops …</p> : null}
              {searchError ? <p className="fine" role="alert">{searchError}</p> : null}
              {!loading && points.length ? (
                <div className="opts pshop-list" role="radiogroup" aria-label="Pakkeshops">
                  {points.map((p) => (
                    <label className="opt" key={p.id}>
                      <input type="radio" name="pakkeshop" checked={selected?.id === p.id} onChange={() => choose(p)} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.address}, {p.zipcode} {p.city}
                        </small>
                        {hoursText(p.hours) ? <small className="hours">{hoursText(p.hours)}</small> : null}
                      </span>
                      <span className="num muted" style={{ fontSize: ".875rem" }}>{distanceText(p.distance)}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              {!zip ? <p className="muted" style={{ fontSize: ".875rem" }}>Skriv dit postnummer, så viser vi de nærmeste pakkeshops.</p> : null}
            </div>
          </section>
        ) : null}
      </div>
      <aside className="summary" aria-label="Oversigt">
        <h2 className="h3">Oversigt</h2>
        <div className="sum-row"><span>Varer</span><span className="num">{kr(total.gross)}</span></div>
        {total.discount > 0 ? (
          <div className="sum-row discount"><span>Samlerabat</span><span className="num">−{kr(total.discount)}</span></div>
        ) : null}
        <div className="sum-row"><span>Fragt</span><span className="num">{kr(total.shipping)}</span></div>
        <div className="sum-row"><span>Køberbeskyttelse</span><span className="num">{kr(total.fee)}</span></div>
        <div className="sum-row total"><span>I alt</span><span className="num">{kr(total.total)}</span></div>
        {needShop && selected ? (
          <p className="fine" style={{ margin: 0 }}>
            Sendes med {CARRIERS[selected.carrier].name} til <b>{selected.name}</b>, {selected.zipcode} {selected.city}
          </p>
        ) : null}
        <button className="btn btn-red btn-block" type="button" onClick={pay} disabled={!ready || busy}>
          {!ready ? "Betaling er ikke sat op endnu" : busy ? "Åbner betaling …" : missingShop ? "Vælg pakkeshop" : `Betal ${kr(total.total)}`}
        </button>
        <p className="fine" style={{ textAlign: "center" }}>
          MobilePay, kort, Apple Pay og Google Pay. Ved at betale accepterer du <a href="/handelsbetingelser">handelsbetingelserne</a>.
        </p>
        <div className="protect">
          <IconShield />
          <span>
            Pengene holdes tilbage hos Relived, indtil du har fået dine varer. Køberbeskyttelsen er 5 % + 5 kr pr. pakke.{" "}
            <a href="/saadan-virker-det#priser">Sådan virker priser og fragt</a>
          </span>
        </div>
      </aside>
    </div>
  );
}
