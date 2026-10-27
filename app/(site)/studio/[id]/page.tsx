import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { Suspense } from "react";
import MitIdResult from "@/components/MitIdResult";
import { mitidState } from "@/lib/mitid";
import { videoShowId } from "@/lib/videoShow";
import { isGuest, showGuests } from "@/lib/guests";
import { ITEM_COLS, MESSAGE_COLS, SHOW_COLS, type CamLayout, type Item, type Message, type Profile, type Show, type ShowLanguage } from "@/lib/types";
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

  const { data: show } = await supabase.from("shows").select(SHOW_COLS).eq("id", id).maybeSingle();
  if (!show) notFound();
  // Værten ejer showet. Gæster (0020_gaester.sql) kan også åbne studiet, men styrer det ikke.
  const role: "host" | "guest" = show.seller_id === uid ? "host" : (await isGuest(supabase, id, uid)) ? "guest" : (notFound() as never);
  // Videoannoncerne ligger i et skjult "show". Det har intet studie; de rettes under Mine shows → Til salg.
  if (role === "host" && (await videoShowId(supabase, uid)) === id) redirect("/studio");
  const [guests, hostQ, guestsQ, layoutQ, langQ] = await Promise.all([
    showGuests(supabase, id),
    role === "guest"
      ? supabase.from("profiles").select("id,handle,display_name,area,avatar_path").eq("id", show.seller_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("show_guests").select("show_id").eq("show_id", id).limit(1),
    // Side om side eller fokus (0022_side_om_side.sql).
    supabase.from("shows").select("cam_layout").eq("id", id).maybeSingle(),
    // Show på engelsk (0023_engelsk.sql).
    supabase.from("shows").select("language").eq("id", id).maybeSingle(),
  ]);
  const host = (role === "guest" ? hostQ.data : profile) as Pick<Profile, "id" | "handle" | "display_name" | "area" | "avatar_path"> | null;
  if (!host) notFound();

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
      role={role}
      host={host}
      guests={guests}
      guestsReady={!guestsQ.error}
      camLayout={layoutQ.error ? null : ((layoutQ.data as { cam_layout?: CamLayout } | null)?.cam_layout ?? "split")}
      language={langQ.error ? null : (langQ.data as { language?: ShowLanguage } | null)?.language === "en" ? "en" : "da"}
    />
    <Suspense fallback={null}>
      <MitIdResult />
    </Suspense>
    </>
  );
}
