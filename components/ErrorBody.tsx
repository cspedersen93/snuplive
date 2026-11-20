"use client";

import { useEffect } from "react";
import { COMPANY } from "@/lib/company";

/** Indholdet på fejlsiden: når en side går i stykker, mens den bliver vist. Bruges af error.tsx-filerne. */
export default function ErrorBody({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[relived] siden kunne ikke vises", error);
  }, [error]);
  return (
    <section className="sec">
      <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
        <span className="label red">Fejl</span>
        <h1 className="h2">Noget gik galt</h1>
        <p className="lede">Siden kunne ikke vises. Fejlen ligger hos os, ikke hos dig. Prøv igen om et øjeblik.</p>
        <div className="ctas">
          <button className="btn btn-ivory" type="button" onClick={reset}>
            Prøv igen
          </button>
          {/* Et almindeligt link, så siden bliver hentet helt forfra. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="btn btn-line" href="/">
            Til forsiden
          </a>
        </div>
        <p className="fine">
          Bliver det ved, så skriv til <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          {error.digest ? `, og nævn koden ${error.digest}` : ""}.
        </p>
      </div>
    </section>
  );
}
