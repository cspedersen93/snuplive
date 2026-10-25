"use client";

import { useState } from "react";
import { FORGETTABLE } from "@/lib/cookies";
import { toast } from "@/lib/toast";

/** Sletter de valg, siden husker i browseren (ikke login og ikke en åben supportsamtale). */
export default function ForgetChoices() {
  const [done, setDone] = useState(false);
  function forget() {
    try {
      FORGETTABLE.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Browseren gemmer ikke noget. Så er der heller ikke noget at glemme.
    }
    setDone(true);
    toast("Dine valg er glemt på denne enhed.");
  }
  return (
    <button className="btn btn-line btn-sm" type="button" onClick={forget} disabled={done} style={{ alignSelf: "flex-start" }}>
      {done ? "Dine valg er glemt" : "Glem mine valg på denne enhed"}
    </button>
  );
}
