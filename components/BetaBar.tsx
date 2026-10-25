import { unquoteEnv } from "@/lib/env";

/**
 * Bjælken øverst. Indtil Relived bruger rigtige Stripe-nøgler, står der tydeligt TESTFASE, så ingen tror, at køb og
 * betalinger er rigtige. Med rigtige nøgler (sk_live_…) forsvinder testfasen af sig selv.
 */
export default function BetaBar() {
  const key = unquoteEnv(process.env.STRIPE_SECRET_KEY);
  const testing = !key || key.startsWith("sk_test_");
  if (testing) {
    return (
      <div className="testbar" role="note" aria-label="Testfase">
        <div className="wrap">
          <strong className="testbar-chip">Testfase</strong>
          <span>
            Relived er ikke åbnet endnu. Alt, der købes og sælges her, er en test: der bliver ikke trukket rigtige penge, og
            ingen ting bliver sendt.
          </span>
        </div>
      </div>
    );
  }
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
