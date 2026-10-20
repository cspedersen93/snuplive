"use client";

import { useState } from "react";

/** Billeder af tingen: ét stort og små under, man kan vælge imellem. */
export default function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="gallery">
      <div className="gallery-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt={alt} />
      </div>
      {images.length > 1 ? (
        <div className="gallery-thumbs" role="group" aria-label="Vælg billede">
          {images.map((src, n) => (
            <button key={src} type="button" onClick={() => setI(n)} aria-pressed={n === i} aria-label={`Billede ${n + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
