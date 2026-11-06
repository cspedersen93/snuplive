import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { num, requireAdmin } from "@/lib/admin";
import { clock, dayLabel } from "@/lib/format";
import { unquoteEnv } from "@/lib/env";
import { CAMPAIGN_SETTINGS, GREEN_FRIDAY, JULEKALENDER } from "@/lib/campaigns";
import { aiConfigured } from "@/lib/claude";
import { isWaitlistRole, WAITLIST_ROLES } from "@/lib/waitlist";
import SettingToggle from "../indstillinger/SettingToggle";
import WaitlistMail from "./WaitlistMail";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nyhedsbrev og venteliste" };

interface Row {
  email: string;
  role: string;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  source: string | null;
}

const at = (iso: string) => `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}`;

/** Hvor på siden man skrev sig op. */
const SOURCES: Record<string, string> = {
  forside: "Kommer snart",
  "saelger-knap": "Kommer snart (sælger)",
  "nyhedsbrev-forside": "Forsiden",
  "nyhedsbrev-side": "Nyhedsbrev-siden",
  "nyhedsbrev-tom-live": "Tom side: Live nu",
  "nyhedsbrev-tom-til-salg": "Tom side: Til salg",
  "nyhedsbrev-tom-budsalg": "Tom side: Budsalg",
  "nyhedsbrev-tom-klip": "Tom side: Klip",
  "nyhedsbrev-tom-kategori": "Tom side: kategori",
};

/** Nyhedsbrevet (og ventelisten fra Kommer snart): hvad der vises på siden, hvem der har skrevet sig op, og mail til dem. */
export default async function Venteliste() {
  const { admin, user } = await requireAdmin("/admin/venteliste");
  if (!admin) return <SetupNotice />;
  const count = (q: ReturnType<typeof base>) => q.then((r) => r.count ?? 0);
  const base = () => admin.from("waitlist").select("id", { count: "exact", head: true });
  const [all, confirmed, sellers, unsub, rowsQ, settingsQ] = await Promise.all([
    count(base()),
    count(base().not("confirmed_at", "is", null).is("unsubscribed_at", null)),
    count(base().not("confirmed_at", "is", null).is("unsubscribed_at", null).in("role", ["seller", "both"])),
    count(base().not("unsubscribed_at", "is", null)),
    admin.from("waitlist").select("email,role,created_at,confirmed_at,unsubscribed_at,source").order("created_at", { ascending: false }).limit(200),
    admin.from("settings").select("key,value").in("key", Object.values(CAMPAIGN_SETTINGS)),
  ]);
  const isOn = (k: string) => (settingsQ.data ?? []).some((r) => r.key === k && r.value === true);
  const rows = (rowsQ.data ?? []) as Row[];
  const mailReady = Boolean(unquoteEnv(process.env.RESEND_API_KEY));

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Nyhedsbrev og venteliste</h1>
        <span className="muted">{num(all)} har skrevet sig op</span>
      </div>
      <div className="stats">
        <div className="stat"><span className="k">Bekræftede</span><span className="v">{num(confirmed)}</span><span className="d">får mails</span></div>
        <div className="stat"><span className="k">Vil sælge</span><span className="v">{num(sellers)}</span><span className="d">sælge eller begge dele</span></div>
        <div className="stat"><span className="k">Ikke bekræftet</span><span className="v">{num(all - confirmed - unsub)}</span></div>
        <div className="stat"><span className="k">Afmeldt</span><span className="v">{num(unsub)}</span></div>
      </div>
      {!mailReady ? (
        <div className="notice" role="alert">
          <span>Mails er ikke sat op (RESEND_API_KEY mangler), så ingen får bekræftelsesmailen. Læg nøglen ind i Vercel.</span>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="btn btn-red btn-sm" href="/api/admin/venteliste" download>Hent de bekræftede som CSV</a>
        <a className="btn btn-line btn-sm" href="/api/admin/venteliste?alle=1" download>Hent alle</a>
      </div>

      <section className="box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h3">På siden</h2>
        <p className="muted" style={{ fontSize: ".875rem" }}>
          Slå nyhedsbrevet og kampagnerne til, når I er klar. Det virker på siden inden for et minut. Siden{" "}
          <a href="/nyhedsbrev" target="_blank" rel="noopener">relived.dk/nyhedsbrev</a> virker altid, og kortene forsvinder af sig selv,
          når en kampagne er slut.
        </p>
        <SettingToggle
          settingKey={CAMPAIGN_SETTINGS.home}
          value={isOn(CAMPAIGN_SETTINGS.home)}
          label="Vis tilmelding til nyhedsbrevet på forsiden"
          help="Feltet står under feedet med de kampagner, der er slået til herunder."
        />
        <SettingToggle
          settingKey={CAMPAIGN_SETTINGS.gf}
          value={isOn(CAMPAIGN_SETTINGS.gf)}
          label={`Vis Green Friday (${GREEN_FRIDAY.label} kl. ${GREEN_FRIDAY.hour})`}
          help="Kortet lover et stort live-show med alle stiftende sælgere efter hinanden. Det forsvinder efter showet."
          confirmOn="Vis Green Friday på siden? Kortet lover et stort live-show fredag 27. november kl. 20 med alle stiftende sælgere."
        />
        <SettingToggle
          settingKey={CAMPAIGN_SETTINGS.jk}
          value={isOn(CAMPAIGN_SETTINGS.jk)}
          label={`Vis julekalenderen (1.–24. december kl. ${JULEKALENDER.hour})`}
          help="Kortet lover et live-show hver aften med én særlig vare på budsalg fra 1 kr. Det forsvinder efter 24. december."
          confirmOn="Vis julekalenderen på siden? Kortet lover et live-show hver aften kl. 20 fra 1. til 24. december med én vare på budsalg fra 1 kr."
        />
      </section>

      <WaitlistMail recipients={confirmed} sellers={sellers} me={user.email ?? ""} aiReady={aiConfigured()} />

      {rows.length ? (
        <div className="table-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th scope="col">E-mail</th>
                <th scope="col">Vil gerne</th>
                <th scope="col">Skrev sig op</th>
                <th scope="col">Hvor</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email}>
                  <td>{r.email}</td>
                  <td>{isWaitlistRole(r.role) ? WAITLIST_ROLES[r.role] : r.role}</td>
                  <td className="muted">{at(r.created_at)}</td>
                  <td className="muted">{r.source ? (SOURCES[r.source] ?? r.source) : ""}</td>
                  <td>
                    {r.unsubscribed_at ? (
                      <span className="muted">Afmeldt</span>
                    ) : r.confirmed_at ? (
                      <span className="chip ok">Bekræftet</span>
                    ) : (
                      <span className="chip">Venter på bekræftelse</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">Ingen har skrevet sig op endnu.</div>
      )}
    </div>
  );
}
