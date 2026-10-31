import { testBannerSetting } from "@/lib/siteAccess";
import { paymentsAreTest } from "@/lib/stripe";

/**
 * Bjælken øverst. TESTFASE vises, så længe betalingen kører i testtilstand, så ingen tror, at køb og betalinger er
 * rigtige. I Backoffice → Indstillinger kan I selv slå den til eller fra (eller lade betalingen bestemme).
 */
export default async function BetaBar() {
  const test = paymentsAreTest();
  const forced = await testBannerSetting();
  if (forced ?? test) {
    return (
      <div className="testbar" role="note" aria-label="Testfase">
        <div className="wrap">
          <strong className="testbar-chip">Testfase</strong>
          <span>
            Relived er ikke åbnet endnu. Alt, der købes og sælges her, er en test: der bliver ikke trukket rigtige penge, og
            ingen varer bliver sendt.
          </span>
        </div>
      </div>
    );
  }
  // Slået fra, mens betalingen stadig er en test: ingen bjælke (den gamle tekst om rigtig betaling ville ikke passe).
  if (test) return null;
  return (
    <div className="demobar" role="note">
      <div className="wrap">
        <span className="live-dot" aria-hidden="true" />
        <span>
          <b>Beta:</b> du kan gå live, købe og betale med MobilePay eller kort. MitID kommer inden lanceringen.
        </span>
      </div>
    </div>
  );
}
