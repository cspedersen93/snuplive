import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import { mitidEnabled } from "@/lib/mitid";
import SettingToggle from "./SettingToggle";
import Testers, { type Tester } from "./Testers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Indstillinger" };

/** Indstillinger for hele SnupLive. Lige nu: om sælgere skal bekræfte sig med MitID for at gå live. */
export default async function Indstillinger() {
  const { admin } = await requireAdmin("/admin/indstillinger");
  if (!admin) return <SetupNotice />;
  const enabled = mitidEnabled();
  const [setting, open, testers, sellers, verified] = await Promise.all([
    admin.from("settings").select("value").eq("key", "mitid_required").maybeSingle(),
    admin.from("settings").select("value").eq("key", "site_open").maybeSingle(),
    admin.from("beta_access").select("email,note").order("added_at", { ascending: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_seller", true),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_seller", true).not("mitid_verified_at", "is", null),
  ]);
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
          confirmOn="Åbn siden for alle nu? Alle kan se shows, ting og sælgere, og Kommer snart forsvinder."
          help="Slå til, når I lancerer. Så forsvinder Kommer snart, og alle kan se shows, ting og sælgere. Det virker inden for et minut."
        />
        <h3 style={{ fontSize: "1rem", marginTop: 8 }}>Testere, der må se hele siden før åbningen</h3>
        <p className="muted" style={{ fontSize: ".9rem" }}>Testeren logger ind på snuplive.dk/login med den e-mail, du skriver her.</p>
        <Testers testers={(testers.data ?? []) as Tester[]} />
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
    </div>
  );
}
