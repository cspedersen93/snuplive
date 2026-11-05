import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SetupNotice from "@/components/SetupNotice";
import { requireProfile } from "@/lib/auth";
import { isGuest } from "@/lib/guests";
import { fetchCountdown } from "@/lib/countdown";
import { ITEM_COLS, MESSAGE_COLS, SHOW_COLS, type Item, type Message, type Show } from "@/lib/types";
import ChatScreen from "./ChatScreen";

export const metadata: Metadata = { title: "Chatten på stor skærm", robots: { index: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chatten med stor skrift på en anden skærm (computer, tablet eller fjernsyn), til sælgere, der filmer med bagkameraet
 * eller står langt fra telefonen. Kun værten og gæsterne i showet kan åbne den.
 */
export default async function ChatSkaerm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProfile(`/studio/${id}/chat`);
  if (!ctx) return <SetupNotice />;
  if (!UUID.test(id)) notFound();
  const { supabase, uid, profile } = ctx;
  const { data: show } = await supabase.from("shows").select(SHOW_COLS).eq("id", id).maybeSingle();
  if (!show) notFound();
  if (show.seller_id !== uid && !(await isGuest(supabase, id, uid))) notFound();
  const [items, messages] = await Promise.all([
    supabase.from("items").select(ITEM_COLS).eq("show_id", id).is("removed_at", null).order("position").order("created_at"),
    supabase.from("messages").select(MESSAGE_COLS).eq("show_id", id).is("removed_at", null).order("id", { ascending: false }).limit(60),
  ]);
  return (
    <ChatScreen
      show={{ ...(show as Show), countdown_to: (await fetchCountdown(supabase, id)).countdownTo }}
      items={(items.data ?? []) as Item[]}
      messages={((messages.data ?? []) as Message[]).reverse()}
      me={{ id: profile.id, handle: profile.handle }}
      canModerate={show.seller_id === uid}
      serverNow={Date.now()}
    />
  );
}
