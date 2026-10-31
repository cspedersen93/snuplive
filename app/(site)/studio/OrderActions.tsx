"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import ShareClipButton from "@/components/ShareClipButton";

export function ShipForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabase().rpc("mark_shipped", { p_order: orderId, p_carrier: carrier, p_tracking: tracking });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast("Pakken er markeret som sendt. Køberen kan nu bekræfte modtagelsen.");
    router.refresh();
  }
  return (
    <form className="ship-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor={`c-${orderId}`}>Fragtfirma (valgfrit)</label>
        <input id={`c-${orderId}`} value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={40} placeholder="Fx GLS" />
      </div>
      <div className="field">
        <label htmlFor={`t-${orderId}`}>Sporingsnummer (valgfrit)</label>
        <input id={`t-${orderId}`} value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} />
      </div>
      <button className="btn btn-red btn-sm" type="submit" disabled={busy}>{busy ? "Gemmer …" : "Markér som sendt"}</button>
    </form>
  );
}

export function RefundButton({ orderId, amount }: { orderId: string; amount: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function refund() {
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/refund`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Refunderingen fejlede.");
      toast("Ordren er annulleret, og køberen får pengene tilbage.");
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
      setAsk(false);
    }
  }
  if (!ask) {
    return (
      <button className="linkbtn" type="button" onClick={() => setAsk(true)}>
        Kan ikke levere? Annullér og refundér
      </button>
    );
  }
  return (
    <div className="confirm-ask">
      <span>Køberen får {amount} tilbage, og tingene kan sælges igen. Det kan ikke fortrydes.</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-red btn-sm" type="button" onClick={refund} disabled={busy}>{busy ? "Refunderer …" : "Ja, refundér"}</button>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(false)} disabled={busy}>Fortryd</button>
      </div>
    </div>
  );
}

export function CancelReservation({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function cancel() {
    setBusy(true);
    const { error } = await getSupabase().rpc("cancel_reservation", { p_sale: saleId });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast("Købet er annulleret, og tingen kan sælges igen.");
    router.refresh();
  }
  return (
    <button className="linkbtn" type="button" onClick={cancel} disabled={busy}>
      {busy ? "Annullerer …" : "Annullér"}
    </button>
  );
}

/** Sælgerens afsenderadresse, som står på fragtlabelen. */
export function SenderAddressForm({
  uid,
  initial,
  fallbackName,
}: {
  uid: string;
  initial: { name: string; address1: string; address2: string | null; zipcode: string; city: string; phone: string | null } | null;
  fallbackName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!initial);
  const [f, setF] = useState({
    name: initial?.name ?? fallbackName,
    address1: initial?.address1 ?? "",
    address2: initial?.address2 ?? "",
    zipcode: initial?.zipcode ?? "",
    city: initial?.city ?? "",
    phone: initial?.phone ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = {
      name: f.name.trim(),
      address1: f.address1.trim(),
      address2: f.address2.trim() || null,
      zipcode: f.zipcode.trim(),
      city: f.city.trim(),
      phone: f.phone.replace(/[^\d+ ]/g, "").trim() || null,
    };
    if (v.name.length < 2) return toast("Skriv dit navn.");
    if (v.address1.length < 3) return toast("Skriv vejnavn og husnummer.");
    if (!/^[0-9]{4}$/.test(v.zipcode)) return toast("Postnummeret skal være 4 cifre.");
    if (v.city.length < 2) return toast("Skriv byen.");
    if (v.phone && !/^\+?[0-9 ]{8,16}$/.test(v.phone)) return toast("Telefonnummeret ser forkert ud.");
    setBusy(true);
    const { error } = await getSupabase()
      .from("seller_addresses")
      .upsert({ user_id: uid, ...v, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast("Din afsenderadresse er gemt.");
    setOpen(false);
    router.refresh();
  }

  if (!open && initial) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <address className="addr">
          {initial.name}, {initial.address1}
          {initial.address2 ? `, ${initial.address2}` : ""}, {initial.zipcode} {initial.city}
          {initial.phone ? ` · ${initial.phone}` : ""}
        </address>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setOpen(true)}>Ret adresse</button>
      </div>
    );
  }
  return (
    <form className="addr-form" onSubmit={save}>
      <div className="field wide">
        <label htmlFor="sa-name">Navn</label>
        <input id="sa-name" value={f.name} onChange={set("name")} maxLength={80} autoComplete="name" required />
      </div>
      <div className="field wide">
        <label htmlFor="sa-a1">Adresse</label>
        <input id="sa-a1" value={f.address1} onChange={set("address1")} maxLength={120} autoComplete="address-line1" placeholder="Vej og nummer" required />
      </div>
      <div className="field wide">
        <label htmlFor="sa-a2">Etage, dør eller c/o (valgfrit)</label>
        <input id="sa-a2" value={f.address2} onChange={set("address2")} maxLength={120} autoComplete="address-line2" />
      </div>
      <div className="field">
        <label htmlFor="sa-zip">Postnummer</label>
        <input id="sa-zip" value={f.zipcode} onChange={set("zipcode")} inputMode="numeric" maxLength={4} autoComplete="postal-code" required />
      </div>
      <div className="field">
        <label htmlFor="sa-city">By</label>
        <input id="sa-city" value={f.city} onChange={set("city")} maxLength={60} autoComplete="address-level2" required />
      </div>
      <div className="field wide">
        <label htmlFor="sa-phone">Telefon (valgfrit)</label>
        <input id="sa-phone" value={f.phone} onChange={set("phone")} inputMode="tel" maxLength={16} autoComplete="tel" placeholder="Fragtfirmaet ringer kun, hvis der er problemer" />
      </div>
      <div className="wide" style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-red btn-sm" type="submit" disabled={busy}>{busy ? "Gemmer …" : "Gem adresse"}</button>
        {initial ? (
          <button className="btn btn-line btn-sm" type="button" onClick={() => setOpen(false)} disabled={busy}>Fortryd</button>
        ) : null}
      </div>
    </form>
  );
}

/** Lav fragtlabelen: sælgeren vælger vægt, og Relived køber labelen hos Shipmondo. */
export function LabelMaker({
  orderId,
  weights,
  hasAddress,
}: {
  orderId: string;
  weights: readonly { grams: number; label: string; hint: string }[];
  hasAddress: boolean;
}) {
  const router = useRouter();
  const [weight, setWeight] = useState<number>(weights[0].grams);
  const [busy, setBusy] = useState(false);
  async function make() {
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/label`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weight }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Labelen kunne ikke laves.");
      toast("Labelen er klar. Hent den, og sæt den på pakken.");
      router.refresh();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!hasAddress) {
    return (
      <p className="fine">
        Udfyld din <a href="#afsender">afsenderadresse</a> herunder, så kan du lave labelen.
      </p>
    );
  }
  return (
    <div className="label-box">
      <fieldset className="weights">
        <legend>Hvor meget vejer pakken?</legend>
        {weights.map((w) => (
          <label key={w.grams}>
            <input type="radio" name={`w-${orderId}`} checked={weight === w.grams} onChange={() => setWeight(w.grams)} />
            <span>
              {w.label} <small>{w.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="row">
        <button className="btn btn-red btn-sm" type="button" onClick={make} disabled={busy}>
          {busy ? "Laver label …" : "Lav fragtlabel"}
        </button>
        <span className="fine">Labelen er betalt af køberens fragt.</span>
      </div>
    </div>
  );
}

/** Sælgeren har afleveret pakken i pakkeshoppen (sporingen gør det også af sig selv). */
export function HandedIn({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function done() {
    setBusy(true);
    const { error } = await getSupabase().rpc("mark_shipped", { p_order: orderId });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast("Tak! Køberen kan nu følge pakken.");
    router.refresh();
  }
  return (
    <button className="btn btn-line btn-sm" type="button" onClick={done} disabled={busy}>
      {busy ? "Gemmer …" : "Jeg har afleveret pakken"}
    </button>
  );
}

export function UnblockButton({ userId, handle }: { userId: string; handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function unblock() {
    setBusy(true);
    const { error } = await getSupabase().rpc("unblock_user", { p_user: userId });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(`@${handle} kan igen skrive og købe i dine shows.`);
    router.refresh();
  }
  return (
    <button className="linkbtn" type="button" onClick={unblock} disabled={busy}>
      {busy ? "Fjerner …" : "Fjern blokering"}
    </button>
  );
}

/** Ret prisen på en ting til salg, eller tag den af. */
export function ForSaleRow({ id, price, forSale }: { id: string; price: number; forSale: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(String(price));
  const [on, setOn] = useState(forSale);
  const [busy, setBusy] = useState(false);
  async function save(fields: { price?: number; for_sale?: boolean }, ok: string) {
    setBusy(true);
    const { error } = await getSupabase().from("items").update(fields).eq("id", id);
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(ok);
    router.refresh();
  }
  const p = Number(value.replace(/[^\d]/g, ""));
  const changed = Number.isInteger(p) && p >= 1 && p <= 100000 && p !== price;
  return (
    <div className="forsale-row">
      <label className="sr-only" htmlFor={`fs-${id}`}>Pris i kr</label>
      <input id={`fs-${id}`} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} disabled={busy} />
      <span className="muted">kr</span>
      {changed ? (
        <button className="btn btn-line btn-sm" type="button" disabled={busy} onClick={() => save({ price: p }, "Prisen er rettet.")}>Gem</button>
      ) : null}
      <label className="switch">
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(e) => {
            setOn(e.target.checked);
            void save({ for_sale: e.target.checked }, e.target.checked ? "Tingen er til salg igen." : "Tingen er taget af.");
          }}
        />
        <span>{on ? "Til salg" : "Taget af"}</span>
      </label>
    </div>
  );
}

/** Videoen af en ting (fra live-showet eller en videoannonce): se den, eller slet den. */
export function ClipRow({ id, href, clip, name, price }: { id: string; href: string; clip?: string | null; name?: string; price?: number }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    const sb = getSupabase();
    const { data, error } = await sb.rpc("clear_item_clip", { p_item: id });
    if (!error && typeof data === "string" && data) await sb.storage.from("clips").remove([data]);
    setBusy(false);
    if (error) return toast(errorText(error));
    toast("Videoen er slettet.");
    router.refresh();
  }
  return (
    <span className="clip-row">
      <a href={href}>Se videoen</a>
      {" · "}
      {ask ? (
        <>
          Slet videoen?{" "}
          <button className="linkbtn" type="button" disabled={busy} onClick={remove}>Ja, slet</button>{" "}
          <button className="linkbtn" type="button" disabled={busy} onClick={() => setAsk(false)}>Nej</button>
        </>
      ) : (
        <button className="linkbtn" type="button" onClick={() => setAsk(true)}>Slet video</button>
      )}
      {clip && name && price != null ? <ShareClipButton src={clip} name={name} price={price} href={href} /> : null}
    </span>
  );
}
