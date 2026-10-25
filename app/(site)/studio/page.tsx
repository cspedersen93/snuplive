import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/AccountNav";
import { IconCamera } from "@/components/Icons";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { clock, dayLabel, when } from "@/lib/format";
import { showImage } from "@/lib/images";
import { ITEM_COUNT_EMBED } from "@/lib/queries";
import { SHOW_COLS, type Show } from "@/lib/types";
import { Suspense } from "react";
import MitIdButton from "@/components/MitIdButton";
import MitIdResult from "@/components/MitIdResult";
import { mitidState } from "@/lib/mitid";
import BecomeSeller from "../konto/BecomeSeller";
import NewShowForm from "./NewShowForm";
import BlockedUsers from "./BlockedUsers";
import ForSale from "./ForSale";
import SellerPayments from "./SellerPayments";
import ShowMenu from "./ShowMenu";

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
          <div className="box become-box">
            <div>
              <span className="label red">Sælg live</span>
              <h1 className="h3" style={{ fontSize: "1.5rem", margin: "6px 0" }}>Bliv sælger på Relived</h1>
              <p className="muted">Opret et show, læg dine ting i køen, og gå live direkte fra browseren. Det er gratis i beta-perioden.</p>
            </div>
            <BecomeSeller />
          </div>
          <p className="muted">Vil du vide mere først? Læs <Link href="/saelg">sådan sælger du live</Link>.</p>
        </div>
      </div>
    );
  }

  const mitid = await mitidState(supabase, profile);
  const showsQ = await supabase
    .from("shows")
    .select(`${SHOW_COLS},${ITEM_COUNT_EMBED}`)
    .eq("seller_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  // Videoannoncerne ligger i et skjult "show" (0019_videoannoncer.sql). Det står ikke i listen.
  const videoQ = await supabase.from("shows").select("id").eq("seller_id", uid).eq("kind", "video");
  const canVideo = !videoQ.error;
  const videoIds = new Set((videoQ.data ?? []).map((r) => r.id as string));
  const all = ((showsQ.data ?? []) as unknown as (Show & { items: { count: number }[] })[]).filter((s) => !videoIds.has(s.id));
  const order = { live: 0, planned: 1, ended: 2 } as const;
  all.sort((a, b) => order[a.status] - order[b.status]);
  // Skjulte shows (findes først, når 0018_skjul.sql er kørt).
  const hiddenQ = await supabase.from("shows").select("id").eq("seller_id", uid).not("hidden_at", "is", null);
  const canHide = !hiddenQ.error;
  const hiddenIds = new Set((hiddenQ.data ?? []).map((r) => r.id as string));
  const shows = all.filter((s) => !hiddenIds.has(s.id));
  const hiddenShows = all.filter((s) => hiddenIds.has(s.id));

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

        {mitid.needed ? (
          <div className="notice" role="status">
            <span>
              <b>Bekræft, hvem du er, med MitID, før du går live.</b> Det tager et minut, og køberne ser mærket MitID-bekræftet ved dine ting.
            </span>
            <MitIdButton next="/studio" className="btn btn-red btn-sm" />
          </div>
        ) : null}
        <Suspense fallback={null}>
          <MitIdResult />
        </Suspense>

        {!profile.seller_terms_at ? (
          <div className="notice" role="status">
            <span>
              <b>Én ting mangler:</b> Bekræft, om du sælger som privatperson eller virksomhed, og sig ja til vilkårene for sælgere.{" "}
              <Link href="/konto#saelger">Gør det her</Link>
            </span>
          </div>
        ) : null}

        <NewShowForm sellerId={uid} />

        {canVideo ? (
          <div className="box vl-entry">
            <div>
              <h2 className="h3">Sælg med video</h2>
              <p className="muted">Har du ikke lyst til at gå live? Film tingen med telefonen, så sætter vi den til salg med video og billeder.</p>
            </div>
            <Link className="btn btn-line" href="/studio/video">
              <IconCamera width={18} height={18} /> Film en ting
            </Link>
          </div>
        ) : null}

        {shows.length ? (
          <ShowTable shows={shows} avatarPath={profile.avatar_path} canHide={canHide} hidden={false} />
        ) : (
          <div className="empty">
            {hiddenShows.length ? "Alle dine shows er skjult." : "Du har ikke oprettet nogen shows endnu. Start med formularen ovenfor."}
          </div>
        )}
        {hiddenShows.length ? (
          <details className="hidden-shows">
            <summary>Vis skjulte shows ({hiddenShows.length})</summary>
            <ShowTable shows={hiddenShows} avatarPath={profile.avatar_path} canHide={canHide} hidden />
          </details>
        ) : null}

        <SellerPayments uid={uid} search={sp} displayName={profile.display_name ?? ""} />
        <ForSale uid={uid} />
        <BlockedUsers uid={uid} />
      </div>
    </div>
  );
}

function ShowTable({
  shows,
  avatarPath,
  canHide,
  hidden,
}: {
  shows: (Show & { items: { count: number }[] })[];
  avatarPath?: string | null;
  canHide: boolean;
  hidden: boolean;
}) {
  return (
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
                    <img src={showImage({ ...s, seller: { avatar_path: avatarPath ?? null } })} alt="" />
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
                  <div className="row-actions">
                    <Link className={`btn btn-sm ${s.status === "ended" ? "btn-ghost" : "btn-red"}`} href={`/studio/${s.id}`}>
                      {s.status === "ended" ? "Se showet" : s.status === "live" ? "Til studiet" : "Åbn studiet"}
                    </Link>
                    <ShowMenu id={s.id} title={s.title} status={s.status} hidden={hidden} canHide={canHide} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
