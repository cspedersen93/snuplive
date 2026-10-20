import { unquoteEnv } from "@/lib/env";

export default function BetaBar() {
  const key = unquoteEnv(process.env.STRIPE_SECRET_KEY);
  const text = !key
    ? "du kan gå live, chatte og snuppe. Betaling, fragt og MitID kommer inden lanceringen."
    : key.startsWith("sk_test_")
      ? "betaling kører i testtilstand, så der bliver ikke trukket rigtige penge. Fragtlabels og MitID kommer inden lanceringen."
      : "du kan gå live, snuppe og betale med MobilePay eller kort. Fragtlabels og MitID kommer inden lanceringen.";
  return (
    <div className="demobar" role="note">
      <div className="wrap">
        <span className="live-dot" aria-hidden="true" />
        <span>
          <b>Beta:</b> {text}
        </span>
      </div>
    </div>
  );
}
