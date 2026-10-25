import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AccountNav from "@/components/AccountNav";
import MitIdButton from "@/components/MitIdButton";
import MitIdResult from "@/components/MitIdResult";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { mitidState } from "@/lib/mitid";
import { videoListingsReady } from "@/lib/videoShow";
import VideoListingClient from "./VideoListingClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sælg med video", robots: { index: false } };

/** Videoannonce: sælgeren filmer tingen og sætter den til salg uden at gå live. */
export default async function VideoListingPage() {
  const ctx = await requireProfile("/studio/video");
  if (!ctx) return <SetupNotice />;
  const { supabase, uid, profile } = ctx;
  if (!profile.is_seller) redirect("/studio");
  const [mitid, ready] = await Promise.all([mitidState(supabase, profile), videoListingsReady(supabase, uid)]);

  return (
    <div className="wrap dash">
      <AccountNav profile={profile} active="studio" />
      <div className="dpanel">
        <div className="dpanel-head">
          <div>
            <span className="label">
              <Link href="/studio">Mine shows</Link>
            </span>
            <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", letterSpacing: "-.035em", lineHeight: 1.05, marginTop: 6 }}>Sælg med video</h1>
          </div>
        </div>

        {!ready ? (
          <div className="empty">Videoannoncer er ikke slået til endnu. Prøv igen lidt senere.</div>
        ) : mitid.needed ? (
          <>
            <div className="notice" role="status">
              <span>
                <b>Bekræft, hvem du er, med MitID, før du sætter ting til salg.</b> Det tager et minut, og køberne ser mærket
                MitID-bekræftet ved dine ting.
              </span>
              <MitIdButton next="/studio/video" className="btn btn-red btn-sm" />
            </div>
            <Suspense fallback={null}>
              <MitIdResult />
            </Suspense>
          </>
        ) : (
          <>
            {!profile.seller_terms_at ? (
              <div className="notice" role="status">
                <span>
                  <b>Én ting mangler:</b> Bekræft, om du sælger som privatperson eller virksomhed, og sig ja til vilkårene for
                  sælgere. <Link href="/konto#saelger">Gør det her</Link>
                </span>
              </div>
            ) : null}
            <VideoListingClient sellerId={uid} />
          </>
        )}
      </div>
    </div>
  );
}
