"use client";

import { useCallback, useEffect, useState } from "react";
import { hasSupabase } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { ITEM_COLS, MESSAGE_COLS, SHOW_COLS, type Item, type Message, type Show } from "@/lib/types";

const MAX_MESSAGES = 200;

export function sortItems(xs: Item[]) {
  return [...xs].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

function upsert(xs: Item[], row: Item) {
  // En ting, der er fjernet efter en anmeldelse, forsvinder hos alle.
  if ((row as Item & { removed_at?: string | null }).removed_at) return xs.filter((x) => x.id !== row.id);
  const i = xs.findIndex((x) => x.id === row.id);
  if (i === -1) return sortItems([...xs, row]);
  const next = xs.slice();
  next[i] = { ...xs[i], ...row };
  return sortItems(next);
}

/**
 * Holder show, ting og chat opdateret i realtid via Supabase Realtime.
 * Ved (gen)forbindelse hentes alt igen, så intet bliver misset.
 */
export function useShowRealtime(initial: { show: Show; items: Item[]; messages: Message[] }) {
  const [show, setShow] = useState(initial.show);
  const [items, setItems] = useState(() => sortItems(initial.items));
  const [messages, setMessages] = useState(initial.messages);
  const [online, setOnline] = useState(false);
  const id = initial.show.id;

  const resync = useCallback(async () => {
    const sb = getSupabase();
    const [s, i, m] = await Promise.all([
      sb.from("shows").select(SHOW_COLS).eq("id", id).maybeSingle(),
      sb.from("items").select(ITEM_COLS).eq("show_id", id).is("removed_at", null),
      sb.from("messages").select(MESSAGE_COLS).eq("show_id", id).is("removed_at", null).order("id", { ascending: false }).limit(60),
    ]);
    if (s.data) setShow(s.data as Show);
    if (i.data) setItems(sortItems(i.data as Item[]));
    if (m.data) setMessages((m.data as Message[]).reverse());
  }, [id]);

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = getSupabase();
    const channel = sb
      .channel(`show:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shows", filter: `id=eq.${id}` }, (p) =>
        setShow((prev) => ({ ...prev, ...(p.new as Show) })),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "items", filter: `show_id=eq.${id}` }, (p) =>
        setItems((xs) => upsert(xs, p.new as Item)),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "items", filter: `show_id=eq.${id}` }, (p) =>
        setItems((xs) => upsert(xs, p.new as Item)),
      )
      // DELETE kan ikke filtreres i Realtime; vi fjerner bare id'et, hvis vi har det.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "items" }, (p) => {
        const oid = (p.old as { id?: string }).id;
        if (oid) setItems((xs) => xs.filter((x) => x.id !== oid));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `show_id=eq.${id}` }, (p) => {
        const msg = p.new as Message;
        if ((msg as { removed_at?: string | null }).removed_at) return;
        setMessages((ms) => (ms.some((m) => m.id === msg.id) ? ms : [...ms, msg].slice(-MAX_MESSAGES)));
      })
      // En besked, sælgeren (eller afsenderen) har fjernet, forsvinder hos alle.
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `show_id=eq.${id}` }, (p) => {
        const row = p.new as Message & { removed_at?: string | null };
        if (row.removed_at) setMessages((ms) => ms.filter((m) => m.id !== row.id));
      })
      .subscribe((status) => {
        setOnline(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void resync();
      });
    return () => {
      void sb.removeChannel(channel);
    };
  }, [id, resync]);

  return { show, items, messages, online, setItems, setShow, resync };
}
