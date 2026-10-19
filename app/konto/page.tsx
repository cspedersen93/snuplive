import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/AccountNav";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { kr } from "@/lib/format";
import BecomeSeller from "./BecomeSeller";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Min konto", robots: { index: false } };

export default async function Konto() {
  const ctx = await requireProfile("/konto");
  if (!ctx) return <SetupNotice />;
  const { supabase, uid, profile } = ctx;

  const [mine, sales, shows] = await Promise.all([
    supabase.from("sales").select("price").eq("buyer_id", uid).eq("status", "reserved"),
    profile.is_seller ? supabase.from("sales").select("price").eq("seller_id", uid) : Promise.resolve({ data: [] as { price: number }[] }),
    profile.is_seller ? supabase.from("shows").select("id,status").eq("seller_id", uid) : Promise.resolve({ data: [] as { id: string; status: string }[] }),
  ]);
  const snup = mine.data ?? [];
  const sold = sales.data ?? [];
  const myShows = shows.data ?? [];
  const liveNow = myShows.some((s) => s.status === "live");

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

        <div className="stats">
          <Link className="stat" href="/kurv" style={{ textDecoration: "none" }}>
            <span className="k">Mine snup</span>
            <span className="v">{snup.length}</span>
            <span className="d">{snup.length ? kr(snup.reduce((a, b) => a + b.price, 0)) : "Snup noget i et show"}</span>
          </Link>
          {profile.is_seller ? (
            <>
              <div className="stat"><span className="k">Shows</span><span className="v">{myShows.length}</span></div>
              <div className="stat"><span className="k">Solgte ting</span><span className="v">{sold.length}</span></div>
              <div className="stat"><span className="k">Omsætning</span><span className="v">{kr(sold.reduce((a, b) => a + b.price, 0))}</span></div>
            </>
          ) : null}
        </div>

        <ProfileForm profile={profile} />

        {profile.is_seller ? (
          <div className="box" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
            <div>
              <h2 className="h3">Din side</h2>
              <p className="muted" style={{ fontSize: ".95rem" }}>Del linket med dine følgere. Det viser altid dit næste eller igangværende show.</p>
            </div>
            <Link className="btn btn-line" href={`/live/${profile.handle}`}>snuplive.dk/live/{profile.handle}</Link>
          </div>
        ) : (
          <div className="next-show" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div>
              <span className="label red">Sælg live</span>
              <h3>Har du et skab, der skal ryddes?</h3>
              <p className="muted" style={{ fontSize: ".95rem" }}>Bliv sælger, læg dine ting i køen, og gå live fra telefonen eller computeren.</p>
            </div>
            <BecomeSeller userId={uid} />
          </div>
        )}
      </div>
    </div>
  );
}
