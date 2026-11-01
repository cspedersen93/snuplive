"use client";

import { IconSparkle } from "@/components/Icons";
import { suggestedPrice, type AiListing } from "@/lib/aiListing";
import { checkText } from "@/lib/aiListingClient";
import { kr } from "@/lib/format";

/** Besked efter "Udfyld med AI": hvad sælgeren skal tjekke, og prisforslaget. */
export default function AiNote({ listing, onUsePrice, onClose }: { listing: AiListing; onUsePrice?: (n: number) => void; onClose: () => void }) {
  const price = suggestedPrice(listing);
  return (
    <div className="ai-note" role="status">
      <IconSparkle />
      <div>
        <p>
          <b>AI har udfyldt felterne.</b> {checkText(listing.unsure)} Det er kun et forslag, så ret det, der ikke passer.
        </p>
        {price && listing.priceLow && listing.priceHigh ? (
          <p className="ai-price">
            <span>
              Prisforslag: {listing.priceLow === listing.priceHigh ? kr(listing.priceLow) : `${kr(listing.priceLow).replace(" kr", "")}–${kr(listing.priceHigh)}`}
            </span>
            {onUsePrice ? (
              <button type="button" className="linkbtn" onClick={() => onUsePrice(price)}>
                Brug {kr(price)}
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
      <button type="button" className="ai-note-x" onClick={onClose} aria-label="Luk beskeden">×</button>
    </div>
  );
}
