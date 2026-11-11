import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PostCard from "@/components/posts/PostCard";
import { fetchPosts } from "@/lib/posts";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Opslag fra dem, du følger", robots: { index: false } };

/** "Følger": de nyeste opslag fra de sælgere, man følger. Kræver login. */
export default async function FollowingFeed() {
  const sb = await createClient();
  const uid = await getUserId(sb);
  if (!uid) redirect("/login?next=/foelger");
  const fol = await sb.from("follows").select("seller_id").eq("follower_id", uid).limit(500);
  const sellers = fol.error ? [] : (fol.data ?? []).map((r) => (r as { seller_id: string }).seller_id);
  const posts = await fetchPosts(sb, { sellers, limit: 40 });

  return (
    <div className="wrap" style={{ paddingBlock: "40px 96px", maxWidth: 760 }}>
      <nav className="crumbs" aria-label="Brødkrummer">
        <Link href="/">Forside</Link>
        <span aria-hidden="true">/</span>
        <span>Følger</span>
      </nav>
      <h1 className="h1" style={{ marginBlock: "20px 8px" }}>Opslag fra dem, du følger</h1>
      <p className="lede" style={{ marginBottom: 28 }}>Her samler vi det nyeste fra de sælgere, du følger: hvad de viser frem næste gang, og hvornår de går live.</p>
      {posts === null ? (
        <p className="empty">Opslag er ikke slået til endnu.</p>
      ) : !sellers.length ? (
        <div className="empty">
          <p style={{ marginBottom: 14 }}>Du følger ikke nogen sælgere endnu. Tryk Følg på en sælger, så dukker deres opslag op her.</p>
          <Link className="btn btn-ivory" href="/live">Find sælgere</Link>
        </div>
      ) : !posts.length ? (
        <div className="empty">
          <p style={{ marginBottom: 14 }}>De sælgere, du følger, har ikke skrevet noget endnu.</p>
          <Link className="btn btn-ivory" href="/live">Se hvem der er live</Link>
        </div>
      ) : (
        <div className="prof-posts">
          {posts.map((p) => <PostCard key={p.id} post={p} next="/foelger" />)}
        </div>
      )}
    </div>
  );
}
