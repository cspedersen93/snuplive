import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import { mitidEnabled } from "@/lib/mitid";
import SettingToggle from "./SettingToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Indstillinger" };

/** Indstillinger for hele SnupLive. Lige nu: om sælgere skal bekræfte sig med MitID for at gå live. */
export default async function Indstillinger() {
  const { admin } = await requireAdmin("/admin/indstillinger");
  if (!admin) return <SetupNotice />;
  const enabled = mitidEnabled();
  const [setting, sellers, verified] = await Promise.all([
    admin.from("settings").select("value").eq("key", "mitid_required").maybeSingle(),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_seller", true),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_seller", true).not("mitid_verified_at", "is", null),
  ]);
  const required = setting.data?.value === true;

  return (
    <div className="adm-page" style={{ maxWidth: 820 }}>
      <div className="adm-head">
        <h1>Indstillinger</h1>
      </div>
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
