import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/AccountNav";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import { PushToggle } from "@/components/PushOffer";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { kr } from "@/lib/format";
import { isAdminEmail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserInfo } from "@/lib/supabase/server";
import { Suspense } from "react";
import MitIdButton from "@/components/MitIdButton";
import MitIdResult from "@/components/MitIdResult";
import { mitidState } from "@/lib/mitid";
import BecomeSeller from "./BecomeSeller";
import ProfileForm from "./ProfileForm";
import { SITE_HOST } from "@/lib/env";
import { videoShowId } from "@/lib/videoShow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Min konto", robots: { index: false } };

export default async function Konto() {
  const ctx = await requireProfile("/konto");
  if (!ctx) return <SetupNotice />;
  const { supabase, uid, profile } = ctx;

  const [mine, sales, shows] = await Promise.all([
    supabase.from("sales").select("price").eq("buyer_id", uid).eq("status", "reserved"),
    profile.is_seller ? supabase.from("sales").select("price").eq("seller_id", uid).neq("status", "cancelled") : Promise.resolve({ data: [] as { price: number }[] }),
    profile.is_seller ? supabase.from("shows").select("id,status").eq("seller_id", uid) : Promise.resolve({ data: [] as { id: string; status: string }[] }),
  ]);
  const mitid = profile.is_seller ? await mitidState(supabase, profile) : null;
  // Følg sælgere (findes først, når 0016_foelg.sql er kørt).
  const [fol, fc] = await Promise.all([
    supabase
      .from("follows")
      .select("created_at,seller:profiles!follows_seller_id_fkey(id,handle,display_name,area,avatar_path)")
      .eq("follower_id", uid)
      .order("created_at", { ascending: false })
      .limit(100),
    profile.is_seller ? supabase.from("profiles").select("follower_count").eq("id", uid).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  type Followed = { id: string; handle: string; display_name: string | null; area: string | null; avatar_path: string | null };
  const following = fol.error ? null : ((fol.data ?? []) as unknown as { seller: Followed | null }[]).map((r) => r.seller).filter((x): x is Followed => !!x);
  const followers = fc.error ? null : ((fc.data as { follower_count?: number } | null)?.follower_count ?? 0);
  const snup = mine.data ?? [];
  const sold = sales.data ?? [];
  // Videoannoncerne ligger i et skjult "show" (0019_videoannoncer.sql). Det tæller ikke med som et show.
  const videoShow = profile.is_seller ? await videoShowId(supabase, uid) : null;
  const myShows = (shows.data ?? []).filter((s) => s.id !== videoShow);
  const liveNow = myShows.some((s) => s.status === "live");

  // Admins ser, hvor mange sager der venter.
  const isAdmin = isAdminEmail((await getUserInfo(supabase))?.email);
  const adminDb = isAdmin ? createAdminClient() : null;
  const openCases = adminDb
    ? ((await adminDb.from("order_issues").select("id", { count: "exact", head: true }).eq("status", "open")).count ?? 0)
    : 0;

  return (
    <div className="wrap dash">
      <AccountNav profile={profile} active="konto" snupCount={snup.length} />
      <div className="dpanel">
        <div className="dpanel-head">
          <div>
            <span className="label">Min konto</span>
            <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", letterSpacing: "-.035em", lineHeight: 1.05, marginTop: 6 }}>
              Hej {profile.display_name || profile.handle}
            </h1>
          </div>
          {profile.is_seller ? (
            <Link className="btn btn-red" href="/studio">
              <span className="live-dot white" aria-hidden="true" />
              {liveNow ? "Tilbage til studiet" : "Gå live"}
            </Link>
          ) : null}
        </div>

        {isAdmin ? (
          <div className={`notice${openCases ? "" : " ok"}`} role="status">
            <span>
              <b>Admin:</b> {openCases ? `${openCases} ${openCases === 1 ? "sag venter" : "sager venter"} på dig.` : "Ingen åbne sager."}{" "}
              <Link href="/admin/sager">Gå til sager</Link> · <Link href="/admin">Backoffice</Link>
            </span>
          </div>
        ) : null}

        <div className="stats">
          <Link className="stat" href="/kurv" style={{ textDecoration: "none" }}>
            <span className="k">Mine køb</span>
            <span className="v">{snup.length}</span>
            <span className="d">{snup.length ? kr(snup.reduce((a, b) => a + b.price, 0)) : "Køb noget i et show"}</span>
          </Link>
          {profile.is_seller ? (
            <>
              {followers !== null ? <div className="stat"><span className="k">Følgere</span><span className="v">{followers}</span></div> : null}
              <div className="stat"><span className="k">Shows</span><span className="v">{myShows.length}</span></div>
              <div className="stat"><span className="k">Solgte ting</span><span className="v">{sold.length}</span></div>
              <div className="stat"><span className="k">Omsætning</span><span className="v">{kr(sold.reduce((a, b) => a + b.price, 0))}</span></div>
            </>
          ) : null}
        </div>

        <ProfileForm profile={profile} />

        {following ? (
          <div className="box" id="foelger">
            <h2 className="h3" style={{ marginBottom: 8 }}>Du følger</h2>
            {following.length ? (
              <ul className="following">
                {following.map((f) => (
                  <li key={f.id}>
                    <Link className="who" href={`/live/${f.handle}`}>
                      <Avatar handle={f.handle} path={f.avatar_path} size={40} />
                      <span style={{ minWidth: 0 }}>
                        <strong>{f.handle}</strong>
                        <span className="muted" style={{ fontSize: ".85rem" }}>{[f.display_name, f.area].filter(Boolean).join(" · ")}</span>
                      </span>
                    </Link>
                    <FollowButton sellerId={f.id} handle={f.handle} next="/konto" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: ".95rem", marginBottom: 6 }}>
                Du følger ikke nogen endnu. Tryk <b>Følg</b> hos en sælger, så får du besked, når sælgeren går live.
              </p>
            )}
            <PushToggle />
          </div>
        ) : null}

        {profile.is_seller ? (
          <div className="box" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
            <div>
              <h2 className="h3">Din side</h2>
              <p className="muted" style={{ fontSize: ".95rem" }}>Del linket med dine følgere. Det viser altid dit næste eller igangværende show.</p>
            </div>
            <Link className="btn btn-line" href={`/live/${profile.handle}`}>{SITE_HOST}/live/{profile.handle}</Link>
          </div>
        ) : (
          <div className="box become-box">
            <div>
              <span className="label red">Sælg live</span>
              <h2 className="h3" style={{ marginTop: 6 }}>Har du et skab, der skal ryddes?</h2>
              <p className="muted" style={{ fontSize: ".95rem" }}>Bliv sælger, læg dine ting i køen, og gå live fra telefonen eller computeren.</p>
            </div>
            <BecomeSeller />
          </div>
        )}

        {profile.is_seller ? (
          <div className="box become-box" id="saelger">
            <div>
              <h2 className="h3">Sælgeroplysninger</h2>
              <p className="muted" style={{ fontSize: ".95rem" }}>Køberne kan se, om du sælger som privatperson eller virksomhed.</p>
            </div>
            <BecomeSeller profile={profile} />
            {mitid?.verified ? (
              <div className="mitid-status">
                <span className="mitid-ok">MitID-bekræftet</span>
                <p className="muted">
                  Du bekræftede dig {new Date(profile.mitid_verified_at as string).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}. Køberne kan se mærket ved dine ting og shows.
                </p>
              </div>
            ) : mitid?.enabled ? (
              <div className="mitid-status">
                <p>
                  Bekræft, hvem du er, med MitID. Så ser køberne mærket <b>MitID-bekræftet</b> ved dine ting og shows.
                  {mitid.required ? " Du skal gøre det, før du kan gå live." : ""}
                </p>
                <MitIdButton next="/konto#saelger" />
              </div>
            ) : null}
          </div>
        ) : null}
        <Suspense fallback={null}>
          <MitIdResult />
        </Suspense>
      </div>
    </div>
  );
}
