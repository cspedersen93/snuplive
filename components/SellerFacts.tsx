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
        {stars ? <Stars avg={seller.rating_avg} count={seller.rating_count} /> : null}
      </span>
      <span className="muted">
        {business ? "Du har 14 dages fortrydelsesret. " : "Køb fra en privatperson er ikke omfattet af fortrydelsesret. "}
        <Link href="/handelsbetingelser#fortrydelsesret">Læs mere</Link>
      </span>
    </div>
  );
}
