import { testBannerSetting } from "@/lib/siteAccess";
import { paymentsAreTest } from "@/lib/stripe";

/**
 * Bjælken øverst. TESTFASE vises, så længe betalingen kører i testtilstand, så ingen tror, at køb og betalinger er
 * rigtige. I Backoffice → Indstillinger kan I selv slå den til eller fra (eller lade betalingen bestemme).
 * Når Relived er åbnet (rigtige Stripe-nøgler), er der ingen bjælke: beta slutter samtidig.
 */
export default async function BetaBar() {
  const test = paymentsAreTest();
  const forced = await testBannerSetting();
  if (!(forced ?? test)) return null;
  return (
    <div className="testbar" role="note" aria-label="Testfase">
      <div className="wrap">
        <strong className="testbar-chip">Testfase</strong>
        {/* På mobil en kort udgave på én linje, så bjælken ikke fylder en fjerdedel af skærmen. */}
        <span className="testbar-long">
          Relived er ikke åbnet endnu. Alt, der købes og sælges her, er en test: der bliver ikke trukket rigtige penge, og
          ingen varer bliver sendt.
        </span>
        <span className="testbar-short">Køb og betaling er kun en test.</span>
      </div>
    </div>
  );
}
