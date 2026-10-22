import Link from "next/link";
import Stars from "@/components/Stars";
import type { SellerFactsData } from "@/lib/types";

/**
 * Det, køberen skal vide om sælgeren (forbrugeraftaleloven § 8 a):
 * om sælgeren er privat eller en virksomhed, og om fortrydelsesretten gælder.
 */
export default function SellerFacts({ seller, stars = true }: { seller: SellerFactsData; stars?: boolean }) {
  const business = seller.seller_type === "business";
  return (
    <div className="seller-facts">
      <span className="seller-type">
        {business ? (
          <>
            <b>Erhverv:</b> {seller.business_name}
            {seller.business_cvr ? `, CVR ${seller.business_cvr}` : ""}
          </>
        ) : (
          <b>Privat sælger</b>
        )}
        {seller.mitid_verified_at ? (
          <span className="mitid-ok" title="Sælgeren har bekræftet, hvem hun eller han er, med MitID">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            MitID-bekræftet
          </span>
        ) : null}
        {stars ? <Stars avg={seller.rating_avg} count={seller.rating_count} /> : null}
      </span>
      <span className="muted">
        {business ? "Du har 14 dages fortrydelsesret. " : "Køb fra en privatperson er ikke omfattet af fortrydelsesret. "}
        <Link href="/handelsbetingelser#fortrydelsesret">Læs mere</Link>
      </span>
    </div>
  );
}
