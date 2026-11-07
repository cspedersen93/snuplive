"use client";

import { isParcel, PARCELS, type Parcel } from "@/lib/pricing";

/** Pakkestørrelse (0030_pakkestoerrelse.sql) eller kun afhentning (0036_kun_afhentning.sql). */
export type DeliveryChoice = Parcel | "pickup";

/**
 * Feltet "Levering" på en vare: lille pakke, stor pakke eller kun afhentning. Bruges i køen i studiet og ved videoannoncer.
 * "Kun afhentning" vises først, når 0036 er kørt.
 */
export default function DeliveryField({
  id,
  value,
  onChange,
  pickupReady = false,
}: {
  id: string;
  value: DeliveryChoice;
  onChange: (v: DeliveryChoice) => void;
  pickupReady?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>Levering</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value === "pickup" ? "pickup" : isParcel(e.target.value) ? e.target.value : "small")}>
        {(Object.keys(PARCELS) as Parcel[]).map((p) => (
          <option key={p} value={p}>
            {PARCELS[p].label}, {PARCELS[p].weight} (køberen betaler {PARCELS[p].price} kr i fragt)
          </option>
        ))}
        {pickupReady ? <option value="pickup">Kun afhentning (for store varer)</option> : null}
      </select>
      {value === "pickup" ? (
        <p className="fine" style={{ marginTop: 6 }}>
          Til varer, der er for store til en pakkeshop. Køberen henter varen gratis hos dig og kan ikke vælge pakkeshop. Du får køberens telefonnummer, når varen er betalt.
        </p>
      ) : null}
    </div>
  );
}
