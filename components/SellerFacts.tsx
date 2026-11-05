import Link from "next/link";
import Stars from "@/components/Stars";
import { BadgeList, LevelChip } from "@/components/Level";
import type { MemberLevel } from "@/lib/levels";
import { bundleText, hasBundle, type BundleTiers } from "@/lib/pricing";
import type { SellerFactsData } from "@/lib/types";

/**
 * Det, køberen skal vide om sælgeren (forbrugeraftaleloven § 8 a):
 * om sælgeren er privat eller en virksomhed, og om fortrydelsesretten gælder.
 */
export default function SellerFacts({
  seller,
  stars = true,
  bundle = null,
  level = null,
}: {
  seller: SellerFactsData;
  stars?: boolean;
  bundle?: BundleTiers | null;
  /** Sælgerens niveau og mærker (0032_niveauer.sql). */
  level?: MemberLevel | null;
}) {
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
        <LevelChip level={level?.seller_level} role="seller" full />
        {stars ? <Stars avg={seller.rating_avg} count={seller.rating_count} /> : null}
      </span>
      <BadgeList badges={level?.badges} role="seller" />
      {hasBundle(bundle) ? (
        <span className="bundle-fact">
          <b>Samlerabat:</b> {bundleText(bundle)}
        </span>
      ) : null}
      <span className="muted">
        {business
          ? "Du har 14 dages fortrydelsesret. "
          : "Køb fra en privatperson er ikke omfattet af fortrydelsesret, men du kan melde et problem, hvis varen ikke er som vist. "}
        <Link href="/handelsbetingelser#fortrydelsesret">Læs mere</Link>
      </span>
    </div>
  );
}
