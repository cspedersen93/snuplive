import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import Avatar from "@/components/Avatar";
import ReportButton from "@/components/ReportButton";
import SellerFacts from "@/components/SellerFacts";
import SetupNotice from "@/components/SetupNotice";
import { when } from "@/lib/format";
import { showImage } from "@/lib/images";
import { createPublicClient } from "@/lib/supabase/public";
import { ITEM_COLS, MESSAGE_COLS, SELLER_FACT_COLS, SHOW_COLS, type CamLayout, type Item, type Message, type Profile, type Show } from "@/lib/types";
import SellerRatings, { type Rating } from "./SellerRatings";
import { sweepStaleShows } from "@/lib/queries";
import ShowClient from "./ShowClient";
import FollowButton from "@/components/FollowButton";
import { videoShowId } from "@/lib/videoShow";
import { showGuests, type Guest } from "@/lib/guests";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };

const load = cache(async (rawHandle: string) => {
  const sb = createPublicClient();
  if (!sb) return { setup: false as const };
  const handle = decodeURIComponent(rawHandle).toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(handle)) return { setup: true as const, seller: null };

  const { data: seller } = await sb
    .from("profiles")
    .select(`id,handle,display_name,area,is_seller,avatar_path,${SELLER_FACT_COLS}`)
    .eq("handle", handle)
    .maybeSingle();
  if (!seller) return { setup: true as const, seller: null };

  await sweepStaleShows();
  const base = () => sb.from("shows").select(SHOW_COLS).eq("seller_id", seller.id).is("removed_at", null);
  // Videoannoncerne ligger i et skjult "show" (0019_videoannoncer.sql). Det skal ikke vises som sælgerens seneste show.
  const videoShow = await videoShowId(sb, seller.id);
  const ended = () => {
    const q = base().eq("status", "ended");
    return videoShow ? q.neq("id", videoShow) : q;
  };
  const [liveQ, nextQ, lastQ] = await Promise.all([
    base().eq("status", "live").limit(1).maybeSingle(),
    base().eq("status", "planned").order("starts_at", { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
    ended().order("ended_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const show = (liveQ.data ?? nextQ.data ?? lastQ.data ?? null) as Show | null;

  let items: Item[] = [];
  let messages: Message[] = [];
  let authOk: string[] = [];
  let guests: Guest[] = [];
  // Er sælgeren med som gæst i en andens show lige nu (0020_gaester.sql)?
  let guestAt: { host: string; title: string } | null = null;
  if (!liveQ.data) {
    const g = await sb
      .from("show_guests")
      .select("show:shows!show_guests_show_id_fkey(title,status,removed_at,host:profiles!shows_seller_id_fkey(handle))")
      .eq("guest_id", seller.id)
      .is("left_at", null);
    const liveShow = ((g.error ? [] : (g.data ?? [])) as unknown as {
      show: { title: string; status: string; removed_at: string | null; host: { handle: string } | null } | null;
    }[])
      .map((r) => r.show)
      .find((x) => x?.status === "live" && !x.removed_at && x.host);
    if (liveShow?.host) guestAt = { host: liveShow.host.handle, title: liveShow.title };
  }
  let camLayout: CamLayout = "split";
  if (show) {
    guests = await showGuests(sb, show.id);
    // Side om side eller fokus (0022_side_om_side.sql). Uden den er det side om side.
    const lq = await sb.from("shows").select("cam_layout").eq("id", show.id).maybeSingle();
    if (!lq.error && (lq.data as { cam_layout?: CamLayout } | null)?.cam_layout === "focus") camLayout = "focus";
    // Show på engelsk (0023_engelsk.sql). Uden den er alle shows på dansk.
    const sq = await sb.from("shows").select("language").eq("id", show.id).maybeSingle();
    if (!sq.error && (sq.data as { language?: string } | null)?.language === "en") (show as Show).language = "en";
    const [i, m] = await Promise.all([
      sb.from("items").select(ITEM_COLS).eq("show_id", show.id).is("removed_at", null).order("position").order("created_at"),
      sb.from("messages").select(MESSAGE_COLS).eq("show_id", show.id).is("removed_at", null).order("id", { ascending: false }).limit(60),
    ]);
    items = (i.data ?? []) as Item[];
    // Ting med mærket Ægthed tjekket (0017_aegthed.sql). Fejler det, vises mærket bare ikke.
    const a = await sb.from("items").select("id").eq("show_id", show.id).eq("auth_required", true).eq("auth_status", "approved");
    authOk = a.error ? [] : (a.data ?? []).map((r) => r.id as string);
    messages = ((m.data ?? []) as Message[]).reverse();
  }
  const r = await sb
    .from("ratings")
    .select("stars,comment,created_at,buyer:profiles!ratings_buyer_id_fkey(handle)")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const ratings = (r.data ?? []) as unknown as Rating[];
  return { setup: true as const, seller: seller as Profile, show, items, messages, ratings, authOk, guests, guestAt, camLayout };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const d = await load(handle);
  if (!d.setup || !d.seller) return { title: "Sælger ikke fundet", robots: { index: false } };
  const name = d.seller.display_name || d.seller.handle;
  const canonical = `/live/${d.seller.handle}`;
  if (d.show?.status === "live") {
    return {
      title: { absolute: `${d.seller.handle} er live: ${d.show.title}`.slice(0, 60) },
      description: `${name} er live på Relived lige nu med ${d.show.title.toLowerCase()}. Se med, stil spørgsmål i chatten, og køb det, du kan lide.`.slice(0, 155),
      alternates: { canonical },
      openGraph: { images: [showImage({ ...d.show, seller: d.seller })] },
    };
  }
  return {
    title: `${d.seller.handle} – live shopping med brugte ting`.slice(0, 48),
    description: d.show
      ? `Følg ${name} på Relived. ${d.show.status === "planned" ? `Næste show: ${d.show.title}, ${when(d.show.starts_at).toLowerCase()}.` : "Se, hvornår næste show starter."}`.slice(0, 155)
      : `${name} sælger brugte ting live på Relived. Kig forbi, når næste show starter.`.slice(0, 155),
    alternates: { canonical },
  };
}

export default async function SellerPage({ params }: Params) {
  const { handle } = await params;
  const d = await load(handle);
  if (!d.setup) return <SetupNotice />;
  if (!d.seller) notFound();

  if (!d.show) {
    return (
      <div className="wrap" style={{ paddingBlock: "48px 96px" }}>
        <nav className="crumbs" aria-label="Brødkrummer">
          <Link href="/">Forside</Link>
          <span aria-hidden="true">/</span>
          <Link href="/live">Live nu</Link>
          <span aria-hidden="true">/</span>
          <span>{d.seller.handle}</span>
        </nav>
        <div className="seller-row" style={{ marginBlock: "28px 18px" }}>
          <Avatar handle={d.seller.handle} path={d.seller.avatar_path} size={56} />
          <div>
            <h1 className="h2">{d.seller.handle}</h1>
            <span className="muted">{[d.seller.display_name, d.seller.area].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        {d.guestAt ? <GuestAtBanner handle={d.seller.handle} at={d.guestAt} /> : null}
        {d.seller.is_seller ? <FollowButton sellerId={d.seller.id} handle={d.seller.handle} next={`/live/${d.seller.handle}`} className="btn btn-red btn-sm" /> : null}
        {d.seller.is_seller ? <SellerFacts seller={d.seller} /> : null}
        <div className="empty" style={{ marginTop: 18 }}>
          <p style={{ marginBottom: 14 }}>
            {d.seller.handle} har ikke planlagt et show endnu.{d.seller.is_seller ? " Følg sælgeren, så får du besked, når der kommer et." : ""}
          </p>
          <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
        </div>
        <SellerRatings handle={d.seller.handle} ratings={d.ratings} avg={d.seller.rating_avg} count={d.seller.rating_count} />
        <ReportButton type="profile" id={d.seller.id} className="page-report" />
      </div>
    );
  }

  return (
    <>
      {d.guestAt ? (
        <div className="wrap" style={{ paddingTop: 18 }}>
          <GuestAtBanner handle={d.seller.handle} at={d.guestAt} />
        </div>
      ) : null}
      <ShowClient
        key={d.show.id}
        seller={{
          id: d.seller.id,
          handle: d.seller.handle,
          display_name: d.seller.display_name,
          area: d.seller.area,
          avatar_path: d.seller.avatar_path,
          seller_type: d.seller.seller_type,
          business_name: d.seller.business_name,
          business_cvr: d.seller.business_cvr,
          rating_avg: d.seller.rating_avg,
          rating_count: d.seller.rating_count,
          mitid_verified_at: d.seller.mitid_verified_at,
        }}
        show={d.show}
        items={d.items}
        messages={d.messages}
        serverNow={Date.now()}
        authOk={d.authOk}
        guests={d.guests}
        camLayout={d.camLayout}
      />
      {d.ratings.length ? (
        <div className="wrap" style={{ paddingBottom: 64 }}>
          <SellerRatings handle={d.seller.handle} ratings={d.ratings} avg={d.seller.rating_avg} count={d.seller.rating_count} />
        </div>
      ) : null}
    </>
  );
}

/** Sælgeren er live som gæst i en andens show lige nu. */
function GuestAtBanner({ handle, at }: { handle: string; at: { host: string; title: string } }) {
  return (
    <Link className="guest-at" href={`/live/${at.host}`}>
      <span className="live-dot" aria-hidden="true" />
      <span>
        <b>{handle} er live nu</b> som gæst hos @{at.host}: {at.title}
      </span>
      <span className="guest-at-go">Se med</span>
    </Link>
  );
}
