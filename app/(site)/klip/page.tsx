import type { Metadata } from "next";
import Link from "next/link";
import { CLIP_BATCH, loadClip, loadClips, type FeedClip } from "@/lib/clipFeed";
import { createPublicClient } from "@/lib/supabase/public";
import ClipFeed from "./ClipFeed";

type Props = { searchParams: Promise<{ ting?: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: { absolute: "Swipe og køb brugte ting i videoklip | Relived" },
  description: "Swipe gennem korte videoer af brugt tøj, design og samleobjekter. Se tingen med lyd og billede, og køb den med ét tryk.",
  alternates: { canonical: "/klip" },
};

export default async function KlipPage({ searchParams }: Props) {
  const { ting } = await searchParams;
  const sb = createPublicClient();
  let clips: FeedClip[] | null = sb ? await loadClips(sb, 0) : null;
  // Et delt link (?ting=…) starter med den ting.
  if (sb && clips && ting && UUID.test(ting)) {
    const first = clips.find((c) => c.id === ting) ?? (await loadClip(sb, ting));
    if (first) clips = [first, ...clips.filter((c) => c.id !== first.id)];
  }

  if (!clips?.length) {
    return (
      <div className="wrap" style={{ paddingBlock: "56px 96px" }}>
        <nav className="crumbs" aria-label="Brødkrummer">
          <Link href="/">Forside</Link>
          <span aria-hidden="true">/</span>
          <span>Klip</span>
        </nav>
        <h1 className="h1" style={{ marginTop: 18 }}>Swipe og køb</h1>
        <div className="empty" style={{ marginTop: 18 }}>
          <p style={{ marginBottom: 14 }}>
            Der er ingen klip lige nu. Her kan du swipe gennem korte videoer af ting til salg, fra live-shows og videoannoncer. Kig forbi igen efter næste show.
          </p>
          <Link className="btn btn-red" href="/til-salg">Se alt til salg</Link>
        </div>
      </div>
    );
  }

  return <ClipFeed initial={clips} batch={CLIP_BATCH} />;
}
