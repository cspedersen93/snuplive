import type { Metadata } from "next";
import Link from "next/link";
import EmptyNext from "@/components/EmptyNext";
import { IconVideo } from "@/components/Icons";
import { CLIP_BATCH, loadClip, loadClips, type FeedClip } from "@/lib/clipFeed";
import { createPublicClient } from "@/lib/supabase/public";
import ClipFeed from "./ClipFeed";
import { og } from "@/lib/og";
import { CrumbsLd } from "@/components/JsonLd";

type Props = { searchParams: Promise<{ ting?: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: { absolute: "Swipe og køb brugte varer i videoklip | Relived" },
  description: "Swipe gennem korte videoer af brugt tøj, design og samleobjekter. Se varen med lyd og billede, og køb den med ét tryk.",
  alternates: { canonical: "/klip" },
  openGraph: og("/klip"),
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
        <CrumbsLd items={[["Forside", "/"], ["Klip", "/klip"]]} />
        <nav className="crumbs" aria-label="Brødkrummer">
          <Link href="/">Forside</Link>
          <span aria-hidden="true">/</span>
          <span>Klip</span>
        </nav>
        <h1 className="h1" style={{ marginTop: 18 }}>Swipe og køb</h1>
        <div style={{ marginTop: 18 }}>
          <EmptyNext
            title="Der er ingen klip lige nu"
            text="Klip af varerne fra showene kommer her. Skriv dig op, så får du besked, når der er nyt."
            icon={<IconVideo />}
            source="nyhedsbrev-tom-klip"
          />
        </div>
        <div className="prose page-text" style={{ marginTop: 40 }}>
          <h2>Korte klip af varer til salg</h2>
          <p>
            Når en sælger viser en vare frem i et show, gemmer vi de første sekunder som et klip. Her kan du swipe gennem klippene, se
            varen med lyd og billede og købe den med ét tryk.
          </p>
          <p>
            Indtil der er klip, kan du se, <Link href="/live">hvem der er live</Link>, eller finde{" "}
            <Link href="/til-salg">brugte varer til fast pris</Link>.
          </p>
        </div>
      </div>
    );
  }

  return <ClipFeed initial={clips} batch={CLIP_BATCH} />;
}
