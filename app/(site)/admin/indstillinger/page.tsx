import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import { mitidEnabled } from "@/lib/mitid";
import SettingToggle from "./SettingToggle";
import FeeFree from "./FeeFree";
import { kr } from "@/lib/format";
import { enforceFeeFreeCap, FEE_FREE_CAP, FEE_FREE_MONTHS, feeFreeActive, feeFreeDay, monthsAhead } from "@/lib/feeFree";
import Testers, { type Tester } from "./Testers";
import DeleteTestShows from "./DeleteTestShows";
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
  const [setting, open, testers, sellers, verified, orderCount, saleCount, banner, showCount, itemCount] = await Promise.all([
    admin.from("settings").select("value").eq("key", "mitid_required").maybeSingle(),
    admin.from("settings").select("value").eq("key", "site_open").maybeSingle(),
    admin.from("beta_access").select("email,note").order("added_at", { ascending: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_seller", true),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_seller", true).not("mitid_verified_at", "is", null),
    admin.from("orders").select("id", { count: "exact", head: true }),
    admin.from("sales").select("id", { count: "exact", head: true }),
    admin.from("settings").select("value").eq("key", "test_banner").maybeSingle(),
    admin.from("shows").select("id", { count: "exact", head: true }),
    admin.from("items").select("id", { count: "exact", head: true }),
  ]);
  // Gratis-kampagnen: stop den først, hvis loftet er nået, og hent så tallene.
  const { setting: free, spend } = await enforceFeeFreeCap(admin);
  const freeOn = feeFreeActive(free);
  const freeDays = free && freeOn ? Math.max(0, Math.ceil((Date.parse(free.until) - Date.now()) / 864e5)) : 0;
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
        <p className="muted" style={{ fontSize: ".9375rem" }}>
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
        <p className="muted" style={{ fontSize: ".875rem" }}>Testeren logger ind på {SITE_HOST}/login med den e-mail, du skriver her.</p>
        <Testers testers={(testers.data ?? []) as Tester[]} />
      </section>

      <section className="box" id="gratis" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h3">Gratis-kampagne: 0 kr i køberbeskyttelse</h2>
        <p className="muted" style={{ fontSize: ".9375rem" }}>
          {freeOn && free
            ? `Kampagnen er i gang til og med ${feeFreeDay(free.until)} (${freeDays} ${freeDays === 1 ? "dag" : "dage"} tilbage). Køberne betaler 0 kr i gebyr, og siden skriver det.`
            : free?.ended
              ? free.reason === "cap"
                ? `Kampagnen stoppede af sig selv ${feeFreeDay(free.ended)}, fordi loftet på ${kr(FEE_FREE_CAP)} blev nået. Køberbeskyttelsen koster igen 5 % + 5 kr.`
                : `Kampagnen blev stoppet ${feeFreeDay(free.ended)}. Køberbeskyttelsen koster igen 5 % + 5 kr.`
              : free
                ? `Kampagnen sluttede ${feeFreeDay(free.until)}. Køberbeskyttelsen koster igen 5 % + 5 kr.`
                : "Kampagnen er ikke startet. Køberbeskyttelsen koster 5 % + 5 kr."}
        </p>
        {spend && free ? (
          <>
            <div className="ff-bar" role="img" aria-label={`Brugt ${kr(spend.cost)} af ${kr(FEE_FREE_CAP)}`}>
              <span style={{ width: `${Math.min(100, Math.round((spend.cost / FEE_FREE_CAP) * 100))}%` }} />
            </div>
            <dl className="ff-stats">
              <div><dt>Brugt indtil nu (skøn)</dt><dd>{kr(spend.cost)} af {kr(FEE_FREE_CAP)}</dd></div>
              <div><dt>Betalte ordrer uden gebyr</dt><dd>{num(spend.orders)}</dd></div>
              <div><dt>Købt for i alt</dt><dd>{kr(spend.volume)}</dd></div>
              <div><dt>Gebyr, vi har givet afkald på</dt><dd>{kr(spend.waived)}</dd></div>
            </dl>
            <p className="muted" style={{ fontSize: ".8125rem" }}>
              "Brugt" er et skøn over, hvad betalingerne koster os hos Stripe: 1,5 % + 1,80 kr pr. betaling, 0,25 % + 0,75 kr pr. udbetaling og
              15 kr om måneden pr. sælger med salg. Rammer det {kr(FEE_FREE_CAP)}, stopper kampagnen af sig selv, og I får en mail.
              Besøgende kan ikke se loftet eller tallene.
            </p>
          </>
        ) : null}
        <FeeFree active={freeOn} suggest={monthsAhead(FEE_FREE_MONTHS)} min={monthsAhead(0)} />
        <p className="muted" style={{ fontSize: ".8125rem" }}>
          Når kampagnen er i gang, står "0 kr i gebyr" og slutdatoen på forsiden, i kurven, på Sælg, Sådan virker det, Spørgsmål og svar og
          i betingelserne. Det kan tage op til fem minutter, før alle sider har skiftet.
        </p>
      </section>

      <section className="box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h3">TESTFASE øverst på siden</h2>
        <p className="muted" style={{ fontSize: ".9375rem" }}>
          Den gule bjælke fortæller alle, at Relived ikke er åbnet endnu, og at køb og betalinger er en test.
        </p>
        <TestBanner mode={bannerMode} test={paymentsAreTest()} />
      </section>

      <section className="box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h3">MitID for sælgere</h2>
        <p className="muted" style={{ fontSize: ".9375rem" }}>
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
          <p className="muted" style={{ fontSize: ".9375rem" }}>
            Betalingen kører i testtilstand. Her kan I slette alle testkøb, så omsætningen (og indberetningen til Skat) starter
            forfra. Det sletter køb, ordrer, bud, sager, bedømmelser og fragtlabels. Solgte varer bliver ikke til salg (sælgeren kan
            sætte dem til salg igen). Shows, varer, sælgere, købere og følgere bliver liggende. Knappen forsvinder, når I skifter til
            rigtige Stripe-nøgler.
          </p>
          <ResetTestSales orders={orderCount.count ?? 0} sales={saleCount.count ?? 0} />
        </section>
      ) : null}

      {testMode ? (
        <section className="box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="h3">Slet alle testshows</h2>
          <p className="muted" style={{ fontSize: ".9375rem" }}>
            Før I åbner: slet alle shows fra testperioden med deres varer, chat, bud og testkøb, så de forsvinder fra siden og
            fra Google. Brugere, sælgerprofiler, følgere og nyhedsbrevet bliver liggende. Knappen forsvinder, når I skifter til
            rigtige Stripe-nøgler. Kræver, at 0031_slet_testshows.sql er kørt i Supabase.
          </p>
          <DeleteTestShows shows={showCount.count ?? 0} items={itemCount.count ?? 0} />
        </section>
      ) : null}
    </div>
  );
}
