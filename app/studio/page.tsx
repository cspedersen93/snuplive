import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/AccountNav";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { clock, dayLabel, when } from "@/lib/format";
import { showImage } from "@/lib/images";
import { ITEM_COUNT_EMBED } from "@/lib/queries";
import { SHOW_COLS, type Show } from "@/lib/types";
import BecomeSeller from "../konto/BecomeSeller";
import NewShowForm from "./NewShowForm";
import BlockedUsers from "./BlockedUsers";
import SellerPayments from "./SellerPayments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mine shows", robots: { index: false } };

const STATUS_CHIP: Record<string, [string, string]> = {
  live: ["live", "Live"],
  planned: ["", "Planlagt"],
  ended: ["sold", "Slut"],
};

export default async function Studio({ searchParams }: { searchParams: Promise<{ udbetaling?: string }> }) {
  const sp = (await searchParams).udbetaling ?? null;
  const ctx = await requireProfile("/studio");
  if (!ctx) return <SetupNotice />;
  const { supabase, uid, profile } = ctx;

  if (!profile.is_seller) {
    return (
      <div className="wrap dash">
        <AccountNav profile={profile} active="studio" />
        <div className="dpanel">
          <div className="next-show" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div>
              <span className="label red">Sælg live</span>
              <h1 className="h3" style={{ fontSize: "1.5rem", margin: "6px 0" }}>Bliv sælger på SnupLive</h1>
              <p className="muted">Opret et show, læg dine ting i køen, og gå live direkte fra browseren. Det er gratis i beta-perioden.</p>
            </div>
            <BecomeSeller userId={uid} />
          </div>
          <p className="muted">Vil du vide mere først? Læs <Link href="/saelg">sådan sælger du live</Link>.</p>
        </div>
      </div>
    );
  }

  const showsQ = await supabase
    .from("shows")
    .select(`${SHOW_COLS},${ITEM_COUNT_EMBED}`)
    .eq("seller_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  const shows = (showsQ.data ?? []) as unknown as (Show & { items: { count: number }[] })[];
  const order = { live: 0, planned: 1, ended: 2 } as const;
  shows.sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div className="wrap dash">
      <AccountNav profile={profile} active="studio" />
      <div className="dpanel">
        <div className="dpanel-head">
          <div>
            <span className="label">Sælger</span>
            <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", letterSpacing: "-.035em", lineHeight: 1.05, marginTop: 6 }}>Mine shows</h1>
          </div>
          <Link className="btn btn-line" href={`/live/${profile.handle}`}>Se min side</Link>
        </div>

        <NewShowForm sellerId={uid} />

        {shows.length ? (
          <div className="table-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th scope="col">Show</th>
                  <th scope="col">Tidspunkt</th>
                  <th scope="col">Ting</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="r"><span style={{ position: "absolute", left: -9999 }}>Handling</span></th>
                </tr>
              </thead>
              <tbody>
                {shows.map((s) => {
                  const [cls, label] = STATUS_CHIP[s.status];
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="it">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={showImage({ ...s, seller: { avatar_path: profile.avatar_path } })} alt="" />
                          <strong style={{ fontWeight: 600 }}>{s.title}</strong>
                        </div>
                      </td>
                      <td className="muted">{s.status === "ended" && s.ended_at ? `${dayLabel(s.ended_at)} ${clock(s.ended_at)}` : when(s.starts_at)}</td>
                      <td className="num">{s.items?.[0]?.count ?? 0}</td>
                      <td>
                        <span className={`chip ${cls}`}>
                          {s.status === "live" ? <span className="live-dot white" /> : null}
                          {label}
                        </span>
                      </td>
                      <td className="r">
                        <Link className={`btn btn-sm ${s.status === "ended" ? "btn-ghost" : "btn-red"}`} href={`/studio/${s.id}`}>
                          {s.status === "ended" ? "Se showet" : s.status === "live" ? "Til studiet" : "Åbn studiet"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Du har ikke oprettet nogen shows endnu. Start med formularen ovenfor.</div>
        )}

        <SellerPayments uid={uid} search={sp} displayName={profile.display_name ?? ""} />
        <BlockedUsers uid={uid} />
      </div>
    </div>
  );
}
