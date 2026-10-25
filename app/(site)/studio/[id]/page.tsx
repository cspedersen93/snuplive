import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { Suspense } from "react";
import MitIdResult from "@/components/MitIdResult";
import { mitidState } from "@/lib/mitid";
import { videoShowId } from "@/lib/videoShow";
import { ITEM_COLS, MESSAGE_COLS, SHOW_COLS, type Item, type Message, type Show } from "@/lib/types";
import StudioClient, { type StudioSale } from "./StudioClient";

export const metadata: Metadata = { title: "Studie", robots: { index: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudioShow({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProfile(`/studio/${id}`);
  if (!ctx) return <SetupNotice />;
  if (!UUID.test(id)) notFound();
  const { supabase, uid, profile } = ctx;

  const { data: show } = await supabase.from("shows").select(SHOW_COLS).eq("id", id).eq("seller_id", uid).maybeSingle();
  if (!show) notFound();
  // Videoannoncerne ligger i et skjult "show". Det har intet studie; de rettes under Mine shows → Til salg.
  if ((await videoShowId(supabase, uid)) === id) redirect("/studio");

  const [mitid, items, messages, sales] = await Promise.all([
    mitidState(supabase, profile),
    supabase.from("items").select(ITEM_COLS).eq("show_id", id).order("position").order("created_at"),
    supabase.from("messages").select(MESSAGE_COLS).eq("show_id", id).is("removed_at", null).order("id", { ascending: false }).limit(60),
    supabase
      .from("sales")
      .select("id,item_id,price,buyer:profiles!sales_buyer_id_fkey(handle)")
      .eq("show_id", id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
    <StudioClient
      profile={profile}
      show={show as Show}
      items={(items.data ?? []) as Item[]}
      messages={((messages.data ?? []) as Message[]).reverse()}
      sales={(sales.data ?? []) as unknown as StudioSale[]}
      serverNow={Date.now()}
      needsMitid={mitid.needed}
    />
    <Suspense fallback={null}>
      <MitIdResult />
    </Suspense>
    </>
  );
}
