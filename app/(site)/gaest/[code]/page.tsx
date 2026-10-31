import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Avatar from "@/components/Avatar";
import MitIdButton from "@/components/MitIdButton";
import MitIdResult from "@/components/MitIdResult";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { when } from "@/lib/format";
import { MAX_GUESTS } from "@/lib/guests";
import { mitidState } from "@/lib/mitid";
import BecomeSeller from "../../konto/BecomeSeller";
import JoinButton from "./JoinButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invitation til et show", robots: { index: false } };

type Info = {
  show_id: string;
  title: string;
  starts_at: string | null;
  status: "planned" | "live" | "ended";
  host_id: string;
  host_handle: string;
  host_avatar: string | null;
  guests: number;
  joined: boolean;
  removed: boolean;
};

/** En sælger har fået et link fra værten og kan sige ja til at være med som gæst i showet. */
export default async function GuestInvite({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = /^[0-9a-f]{32}$/i.test(code) ? code.toLowerCase() : null;
  const next = `/gaest/${code}`;
  const ctx = await requireProfile(next);
  if (!ctx) return <SetupNotice />;
  const { supabase, uid, profile } = ctx;
  const { data } = clean ? await supabase.rpc("guest_invite_info", { p_code: clean }) : { data: null };
  const info = (Array.isArray(data) ? data[0] : data) as Info | null | undefined;
  if (info?.joined) redirect(`/studio/${info.show_id}`);

  let body: React.ReactNode;
  if (!info) {
    body = <Problem title="Invitationen gælder ikke længere" text="Bed værten om et nyt link til showet." />;
  } else if (info.status === "ended") {
    body = <Problem title="Showet er slut" text={`Følg @${info.host_handle}, så får du besked næste gang.`} />;
  } else if (info.host_id === uid) {
    body = (
      <Problem title="Det er dit eget show" text="Send linket til den sælger, du vil have med i showet.">
        <Link className="btn btn-red btn-sm" href={`/studio/${info.show_id}`}>Til studiet</Link>
      </Problem>
    );
  } else if (info.removed) {
    body = <Problem title="Du er ikke med i showet" text={`@${info.host_handle} har taget dig ud af showet.`} />;
  } else if (info.guests >= MAX_GUESTS) {
    body = <Problem title="Showet er fuldt" text={`Der er allerede ${MAX_GUESTS} gæster i @${info.host_handle}s show.`} />;
  } else {
    const mitid = profile.is_seller ? await mitidState(supabase, profile) : null;
    body = (
      <div className="box guest-invite">
        <div className="seller-row">
          <Avatar handle={info.host_handle} path={info.host_avatar} />
          <div>
            <strong>@{info.host_handle} har inviteret dig med i sit show</strong>
            <span className="muted" style={{ fontSize: ".9rem" }}>
              {info.title} · {info.status === "live" ? "Live nu" : when(info.starts_at)}
            </span>
          </div>
        </div>
        <ul className="guest-points">
          <li>Du er på kameraet sammen med @{info.host_handle}, og I kan høre hinanden.</li>
          <li>Du lægger dine egne varer i køen. Pengene for dem går til dig, og du sender dem selv.</li>
          <li>@{info.host_handle} styrer showet: hvad der vises, budsalg, lynrunder og chatten.</li>
          <li>Dine følgere får besked, når showet går live.</li>
        </ul>
        {!profile.is_seller ? (
          <>
            <p className="muted">For at være med skal du være sælger på Relived. Det tager et minut.</p>
            <BecomeSeller next={next} label="Bliv sælger" />
          </>
        ) : mitid?.needed ? (
          <>
            <p className="muted">Bekræft, hvem du er, med MitID, før du er med i et show. Det tager et minut.</p>
            <MitIdButton next={next} className="btn btn-red" />
            <Suspense fallback={null}>
              <MitIdResult />
            </Suspense>
          </>
        ) : (
          <JoinButton code={clean as string} hostHandle={info.host_handle} />
        )}
        <p className="fine">
          Du står selv for dine varer, som når du sælger i dit eget show. Læs <Link href="/vilkaar">vilkårene for sælgere</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 640, paddingTop: 40, paddingBottom: 60 }}>
      <span className="label red">Gæst i showet</span>
      <h1 className="h2" style={{ margin: "8px 0 18px" }}>Vær med i et show</h1>
      {body}
    </div>
  );
}

function Problem({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="box guest-invite" role="status">
      <h2 className="h3">{title}</h2>
      <p className="muted">{text}</p>
      {children}
      <Link className="linkbtn" href="/studio" style={{ alignSelf: "flex-start" }}>Til Mine shows</Link>
    </div>
  );
}
