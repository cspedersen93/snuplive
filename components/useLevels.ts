"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { toMemberLevel, type MemberLevel } from "@/lib/levels";

/**
 * Niveauerne for dem, der skriver i chatten. Hentes samlet og huskes i 5 minutter, så en travl chat ikke
 * spørger databasen for hver besked. Er 0032_niveauer.sql ikke kørt, holder vi op med at spørge.
 */
const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; level: MemberLevel | null }>();
let off = false;
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

async function flush() {
  timer = null;
  const ids = [...queue].slice(0, 100);
  queue = new Set([...queue].slice(100));
  if (queue.size) timer = setTimeout(flush, 50);
  if (!ids.length || off) return;
  const now = Date.now();
  // Markér dem som hentet med det samme, så de ikke bliver spurgt om igen, mens svaret er på vej.
  for (const id of ids) cache.set(id, { at: now, level: cache.get(id)?.level ?? null });
  const { data, error } = await getSupabase().rpc("member_levels", { p_ids: ids });
  if (error) {
    off = true;
    return;
  }
  for (const row of (data ?? []) as MemberLevel[]) {
    const m = toMemberLevel(row);
    cache.set(m.id, { at: now, level: m });
  }
  for (const fn of listeners) fn();
}

export function useLevels(ids: (string | null | undefined)[]) {
  const [, bump] = useState(0);
  const key = [...new Set(ids.filter(Boolean))].sort().join(",");

  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (off || !key) return;
    const now = Date.now();
    let added = false;
    for (const id of key.split(",")) {
      const c = cache.get(id);
      if (!c || now - c.at > TTL) {
        queue.add(id);
        added = true;
      }
    }
    if (added && !timer) timer = setTimeout(flush, 150);
  }, [key]);

  return (id: string | null | undefined) => (id ? (cache.get(id)?.level ?? null) : null);
}
