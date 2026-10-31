import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import { mitidEnabled } from "@/lib/mitid";
import SettingToggle from "./SettingToggle";
import Testers, { type Tester } from "./Testers";
import ResetTestSales from "./ResetTestSales";
import TestBanner from "./TestBanner";
import { canResetTestSales, paymentsAreTest } from "@/lib/stripe";
import { SITE_HOST } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Indstillinger" };

/** Indstillinger for hele Relived. Lige nu: om sælgere skal bekræfte sig med MitID for at gå live. */
export default async function Indstillinger() {
  const { admin } = await requireAdmin("/admin/indstillinger");
  if (!admin) return <SetupNotice />;
  const enabled = mitidEnabled();
  const testMode = canResetTestSales();
  const [setting, open, testers, sellers, verified, orderCount, saleCount, banner] = await Promise.all([
    admin.from("settings").select("value").eq("key", "mitid_required").maybeSingle(),
    admin.from("settings").select("value").eq("key", "site_open").maybeSingle(),
    admin.from("beta_access").select("email,note").order("added_at", { ascending: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_seller", true),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_seller", true).not("mitid_verified_at", "is", null),
    admin.from("orders").select("id", { count: "exact", head: true }),
    admin.from("sales").select("id", { count: "exact", head: true }),
    admin.from("settings").select("value").eq("key", "test_banner").maybeSingle(),
  ]);
  const bannerMode = banner.data?.value === true ? "on" : banner.data?.value === false ? "off" : "auto";
  const required = setting.data?.value === true;
  const siteIsOpen = open.data ? open.data.value !== false : true;

  return (
    <div className="adm-page" style={{ maxWidth: 820 }}>
      <div className="adm-head">
        <h1>Indstillinger</h1>
      </div>
      <section className="box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h3">Åbning</h2>
        <p className="muted" style={{ fontSize: ".95rem" }}>
          {siteIsOpen
            ? "Siden er åben for alle."
            : "Siden er lukket. Besøgende ser kun Kommer snart og kan skrive sig op. Admins og testere ser hele siden, når de er logget ind."}
        </p>
        <SettingToggle
          settingKey="site_open"
          value={siteIsOpen}
          label="Siden er åben for alle"
          confirmOn="Åbn siden for alle nu? Alle kan se shows, varer og sælgere, og Kommer snart forsvinder."
          help="Slå til, når I lancerer. Så forsvinder Kommer snart, og alle kan se shows, varer og sælgere. Det virker inden for et minut."
        />
        <h3 style={{ fontSize: "1rem", marginTop: 8 }}>Testere, der må se hele siden før åbningen</h3>
        <p className="muted" style={{ fontSize: ".9rem" }}>Testeren logger ind på {SITE_HOST}/login med den e-mail, du skriver her.</p>
        <Testers testers={(testers.data ?? []) as Tester[]} />
      </section>

      <section className="box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h3">TESTFASE øverst på siden</h2>
        <p className="muted" style={{ fontSize: ".95rem" }}>
          Den gule bjælke fortæller alle, at Relived ikke er åbnet endnu, og at køb og betalinger er en test.
        </p>
        <TestBanner mode={bannerMode} test={paymentsAreTest()} />
      </section>

      <section className="box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h3">MitID for sælgere</h2>
        <p className="muted" style={{ fontSize: ".95rem" }}>
          {enabled
            ? `MitID er sat op. ${num(verified.count ?? 0)} af ${num(sellers.count ?? 0)} sælgere har bekræftet sig.`
            : "MitID er ikke sat op endnu. Læg IDURA_DOMAIN, IDURA_CLIENT_ID og IDURA_CLIENT_SECRET ind i Vercel, og tryk Redeploy."}
        </p>
        <SettingToggle
          settingKey="mitid_required"
          value={required}
          disabled={!enabled && !required}
          label="Sælgere skal bekræfte sig med MitID, før de kan gå live"
          help="Shows, der allerede er live, kører videre. Sælgere, der ikke har bekræftet sig, får en knap til MitID i studiet."
        />
      </section>

      {testMode ? (
        <section className="box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="h3">Nulstil testsalg</h2>
          <p className="muted" style={{ fontSize: ".95rem" }}>
            Betalingen kører i testtilstand. Her kan I slette alle testkøb, så omsætningen (og indberetningen til Skat) starter
            forfra. Det sletter køb, ordrer, bud, sager, bedømmelser og fragtlabels. Solgte varer bliver ikke til salg (sælgeren kan
            sætte dem til salg igen). Shows, varer, sælgere, købere og følgere bliver liggende. Knappen forsvinder, når I skifter til
            rigtige Stripe-nøgler.
          </p>
          <ResetTestSales orders={orderCount.count ?? 0} sales={saleCount.count ?? 0} />
        </section>
      ) : null}
    </div>
  );
}
