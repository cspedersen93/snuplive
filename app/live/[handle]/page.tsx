import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import Avatar from "@/components/Avatar";
import SetupNotice from "@/components/SetupNotice";
import { when } from "@/lib/format";
import { showImage } from "@/lib/images";
import { createPublicClient } from "@/lib/supabase/public";
import { ITEM_COLS, MESSAGE_COLS, SHOW_COLS, type Item, type Message, type Profile, type Show } from "@/lib/types";
import ShowClient from "./ShowClient";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };

const load = cache(async (rawHandle: string) => {
  const sb = createPublicClient();
  if (!sb) return { setup: false as const };
  const handle = decodeURIComponent(rawHandle).toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(handle)) return { setup: true as const, seller: null };

  const { data: seller } = await sb
    .from("profiles")
    .select("id,handle,display_name,area,is_seller,avatar_path")
    .eq("handle", handle)
    .maybeSingle();
  if (!seller) return { setup: true as const, seller: null };

  const base = () => sb.from("shows").select(SHOW_COLS).eq("seller_id", seller.id);
  const [liveQ, nextQ, lastQ] = await Promise.all([
    base().eq("status", "live").limit(1).maybeSingle(),
    base().eq("status", "planned").order("starts_at", { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
    base().eq("status", "ended").order("ended_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const show = (liveQ.data ?? nextQ.data ?? lastQ.data ?? null) as Show | null;

  let items: Item[] = [];
  let messages: Message[] = [];
  if (show) {
    const [i, m] = await Promise.all([
      sb.from("items").select(ITEM_COLS).eq("show_id", show.id).order("position").order("created_at"),
      sb.from("messages").select(MESSAGE_COLS).eq("show_id", show.id).is("removed_at", null).order("id", { ascending: false }).limit(60),
    ]);
    items = (i.data ?? []) as Item[];
    messages = ((m.data ?? []) as Message[]).reverse();
  }
  return { setup: true as const, seller: seller as Profile, show, items, messages };
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
      description: `${name} er live på SnupLive lige nu med ${d.show.title.toLowerCase()}. Se med, stil spørgsmål i chatten, og snup det, du kan lide.`.slice(0, 155),
      alternates: { canonical },
      openGraph: { images: [showImage({ ...d.show, seller: d.seller })] },
    };
  }
  return {
    title: `${d.seller.handle} – live shopping med brugte ting`.slice(0, 48),
    description: d.show
      ? `Følg ${name} på SnupLive. ${d.show.status === "planned" ? `Næste show: ${d.show.title}, ${when(d.show.starts_at).toLowerCase()}.` : "Se, hvornår næste show starter."}`.slice(0, 155)
      : `${name} sælger brugte ting live på SnupLive. Kig forbi, når næste show starter.`.slice(0, 155),
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
        <div className="empty">
          <p style={{ marginBottom: 14 }}>{d.seller.handle} har ikke planlagt et show endnu.</p>
          <Link className="btn btn-red" href="/live">Se hvem der er live</Link>
        </div>
      </div>
    );
  }

  return (
    <ShowClient
      key={d.show.id}
      seller={{ id: d.seller.id, handle: d.seller.handle, display_name: d.seller.display_name, area: d.seller.area, avatar_path: d.seller.avatar_path }}
      show={d.show}
      items={d.items}
      messages={d.messages}
      serverNow={Date.now()}
    />
  );
}
