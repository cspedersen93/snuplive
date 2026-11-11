import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import ItemCard from "@/components/ItemCard";
import PostCard from "@/components/posts/PostCard";
import PostComposer from "@/components/posts/PostComposer";
import RemindButton from "@/components/RemindButton";
import ReportButton from "@/components/ReportButton";
import SellerFacts from "@/components/SellerFacts";
import SetupNotice from "@/components/SetupNotice";
import { fetchBundle } from "@/lib/bundles";
import { clock, dayLabel, vareOrd } from "@/lib/format";
import { storageUrl } from "@/lib/images";
import { fetchLevel } from "@/lib/levels";
import { fetchPosts, fetchProfileExtra } from "@/lib/posts";
import { fetchFeed } from "@/lib/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient, getUserId } from "@/lib/supabase/server";
import { SELLER_FACT_COLS, type Profile } from "@/lib/types";
import { videoShowId } from "@/lib/videoShow";
import SellerRatings, { type Rating } from "../../live/[handle]/SellerRatings";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };
type ShowRow = { id: string; title: string; status: string; starts_at: string | null };

/**
 * Sælgerens profil: forsidebillede, en kort tekst, tal, næste show, opslag, varer til salg og bedømmelser.
 * Selve showet ligger stadig på /live/[handle]. Tekst, forsidebillede og opslag kræver 0037_profil_opslag.sql;
 * uden den vises profilen bare uden dem.
 */
const load = cache(async (rawHandle: string) => {
  const sb = createPublicClient();
  if (!sb) return { setup: false as const };
  const handle = decodeURIComponent(rawHandle).toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(handle)) return { setup: true as const, seller: null };
  const { data: seller } = await sb
    .from("profiles")
    .select(`id,handle,display_name,area,is_seller,avatar_path,created_at,${SELLER_FACT_COLS}`)
    .eq("handle", handle)
    .maybeSingle();
  if (!seller) return { setup: true as const, seller: null };
  const s = seller as Profile & { created_at: string };

  const videoShow = await videoShowId(sb, s.id);
  const [extra, posts, forSale, upcoming, showsQ, soldQ, fcQ, ratingsQ, bundle, level] = await Promise.all([
    fetchProfileExtra(sb, s.id),
    fetchPosts(sb, { seller: s.id, limit: 20 }),
    fetchFeed("for_sale", { seller: s.id, limit: 12 }),
    fetchFeed("upcoming", { seller: s.id, limit: 8 }),
    sb.from("shows").select("id,title,status,starts_at").eq("seller_id", s.id).is("removed_at", null).in("status", ["live", "planned"]).order("starts_at", { ascending: true, nullsFirst: false }).limit(8),
    sb.from("items").select("id", { count: "exact", head: true }).eq("seller_id", s.id).eq("status", "sold"),
    sb.from("profiles").select("follower_count").eq("id", s.id).maybeSingle(),
    sb.from("ratings").select("stars,comment,created_at,buyer:profiles!ratings_buyer_id_fkey(handle)").eq("seller_id", s.id).order("created_at", { ascending: false }).limit(10),
    fetchBundle(sb, s.id),
    fetchLevel(sb, s.id),
  ]);
  let shows = ((showsQ.data ?? []) as ShowRow[]).filter((x) => x.id !== videoShow);
  // Lukkede shows (0026_lukkede_shows.sql) vises ikke på profilen.
  if (shows.length) {
    const inv = await sb.from("shows").select("id").in("id", shows.map((x) => x.id)).eq("visibility", "invite");
    const hide = new Set(inv.error ? [] : (inv.data ?? []).map((r) => (r as { id: string }).id));
    shows = shows.filter((x) => !hide.has(x.id));
  }
  const live = shows.find((x) => x.status === "live") ?? null;
  const planned = shows.filter((x) => x.status === "planned");
  return {
    setup: true as const,
    seller: s,
    extra,
    posts,
    forSale,
    upcoming,
    live,
    planned,
    sold: soldQ.error ? null : (soldQ.count ?? 0),
    followers: fcQ.error ? null : ((fcQ.data as { follower_count?: number } | null)?.follower_count ?? 0),
    ratings: (ratingsQ.data ?? []) as unknown as Rating[],
    bundle,
    level,
  };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const d = await load(handle);
  if (!d.setup || !d.seller || !d.seller.is_seller) return { title: "Sælger ikke fundet", robots: { index: false } };
  const s = d.seller;
  const where = s.area ? ` fra ${s.area}` : "";
  const desc = d.extra?.bio?.trim() || `Se varer, opslag og kommende live shows fra ${s.handle}${where}. Køb second hand, du har set på video.`;
  return {
    title: `${s.handle}: second hand${where}`,
    description: desc.slice(0, 155),
    alternates: { canonical: `/profil/${s.handle}` },
    openGraph: d.extra?.cover_path ? { images: [storageUrl("covers", d.extra.cover_path)] } : undefined,
  };
}

export default async function ProfilePage({ params }: Params) {
  const { handle } = await params;
  const d = await load(handle);
  if (!d.setup) return <SetupNotice />;
  if (!d.seller) notFound();
  const s = d.seller;
  // Købere har ikke en profil med opslag. De vises på den gamle side.
  if (!s.is_seller) redirect(`/live/${s.handle}`);
  const uid = await getUserId(await createClient());
  const own = uid === s.id;
  const next = `/profil/${s.handle}`;
  const since = new Date(s.created_at).toLocaleDateString("da-DK", { month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });
  const nextShow = d.planned[0] ?? null;

  return (
    <div className="prof">
      <div className={`prof-cover${d.extra?.cover_path ? "" : " none"}`}>
        {d.extra?.cover_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={storageUrl("covers", d.extra.cover_path)} alt="" />
        ) : null}
      </div>
      <div className="wrap prof-wrap">
        <header className="prof-head">
          <Avatar handle={s.handle} path={s.avatar_path} size={112} className="prof-ava" />
          <div className="prof-id">
            <h1 className="h2">{s.handle}</h1>
            <span className="muted">{[s.display_name, s.area].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="prof-actions">
            {own ? (
              <Link className="btn btn-line btn-sm" href="/konto#profil">Rediger profil</Link>
            ) : (
              <FollowButton sellerId={s.id} handle={s.handle} next={next} className="btn btn-ivory btn-sm" />
            )}
          </div>
        </header>

        {d.extra?.bio ? <p className="prof-bio">{d.extra.bio}</p> : own && d.extra ? (
          <p className="prof-bio muted">Du har ikke skrevet noget om dig selv endnu. <Link href="/konto#profil">Tilføj en kort tekst</Link>, så køberne ved, hvad du sælger.</p>
        ) : null}

        <ul className="prof-stats">
          {d.followers !== null ? <li><b>{d.followers}</b> {d.followers === 1 ? "følger" : "følgere"}</li> : null}
          {d.sold ? <li><b>{d.sold}</b> solgte {d.sold === 1 ? "vare" : "varer"}</li> : null}
          <li>Med siden <b>{since}</b></li>
        </ul>
        <SellerFacts seller={s} bundle={d.bundle} level={d.level} />

        {d.live ? (
          <div className="prof-show live">
            <span>
              <span className="label red"><span className="live-dot" aria-hidden="true" />Live nu</span>
              <b>{d.live.title}</b>
            </span>
            <Link className="btn btn-red" href={`/live/${s.handle}`}>Se med</Link>
          </div>
        ) : nextShow ? (
          <div className="prof-show">
            <span>
              <span className="label brass">Næste show · {nextShow.starts_at ? `${dayLabel(nextShow.starts_at).toLowerCase()} kl. ${clock(nextShow.starts_at)}` : "tidspunkt kommer"}</span>
              <Link href={`/live/${s.handle}`}><b>{nextShow.title}</b></Link>
            </span>
            <RemindButton showId={nextShow.id} next={next} className="btn btn-line btn-sm" />
          </div>
        ) : null}

        <div className="prof-cols">
          <section className="prof-posts" aria-labelledby="h-opslag">
            <h2 className="h3" id="h-opslag">Opslag</h2>
            {own && d.posts ? <PostComposer uid={s.id} shows={d.planned.map((x) => ({ id: x.id, title: x.title }))} /> : null}
            {d.posts?.length ? (
              d.posts.map((p) => <PostCard key={p.id} post={p} own={own} next={next} />)
            ) : (
              <p className="empty prof-empty">
                {own
                  ? d.posts
                    ? "Du har ikke skrevet et opslag endnu. Fortæl, hvad du viser frem næste gang, så får dine følgere besked."
                    : "Opslag er ikke slået til endnu."
                  : `${s.handle} har ikke skrevet et opslag endnu.`}
              </p>
            )}
          </section>

          <div className="prof-side">
            {d.forSale.length ? (
              <section aria-labelledby="h-tilsalg">
                <div className="row-head">
                  <h2 className="h3" id="h-tilsalg">Til salg nu</h2>
                  <span className="muted">{d.forSale.length} {vareOrd(d.forSale.length)}</span>
                </div>
                <div className="prof-items">
                  {d.forSale.map((it) => <ItemCard key={it.id} item={it} />)}
                </div>
              </section>
            ) : null}
            {d.upcoming.length ? (
              <section aria-labelledby="h-kommer">
                <h2 className="h3" id="h-kommer">Kommer i næste show</h2>
                <div className="prof-items">
                  {d.upcoming.map((it) => <ItemCard key={it.id} item={it} />)}
                </div>
              </section>
            ) : null}
            {!d.forSale.length && !d.upcoming.length ? (
              <p className="empty prof-empty">{s.handle} har ingen varer til salg lige nu. Følg sælgeren, så får du besked, når der kommer nye.</p>
            ) : null}
          </div>
        </div>

        <SellerRatings handle={s.handle} ratings={d.ratings} avg={s.rating_avg} count={s.rating_count} />
        {own ? null : <ReportButton type="profile" id={s.id} className="page-report" />}
      </div>
    </div>
  );
}
