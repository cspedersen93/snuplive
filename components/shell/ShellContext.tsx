"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { hasSupabase } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";

export interface ShellMe {
  id: string;
  handle: string;
  avatar_path: string | null;
  is_seller: boolean;
}

export interface Followed {
  id: string;
  handle: string;
  avatar_path: string | null;
}

export interface Shell {
  /** null = henter endnu, false = ikke logget ind. */
  signedIn: boolean | null;
  me: ShellMe | null;
  /** Køb, der venter på betaling (det tal, der står ved kurven). */
  cartCount: number;
  /** Hvor mange shows der er live lige nu, og hvilke sælgere der sender. */
  liveCount: number;
  liveSellers: string[];
  /** Sælgere, man følger (de første 8). */
  follows: Followed[];
}

const empty: Shell ={ signedIn: null, me: null, cartCount: 0, liveCount: 0, liveSellers: [], follows: [] };
const Ctx = createContext<Shell>(empty);

export const useShell = () => useContext(Ctx);

/**
 * Det, menuen, toppen og bundmenuen skal vide om den, der kigger: logget ind, kurv, hvem man følger, og hvem der er live.
 * Hentes én gang her, så de tre dele ikke spørger databasen hver for sig.
 */
export default function ShellProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Shell>(empty);

  useEffect(() => {
    let alive = true;
    const loadLive = async () => {
      try {
        // Uden browserens egen cache: svaret gemmes allerede 30 sekunder på serveren, og browserens "brug det gamle og
        // hent nyt i baggrunden" gav en forespørgsel, der hang i baggrunden.
        const r = await fetch("/api/live-now", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { count?: number; sellers?: string[] };
        if (alive) setState((s) => ({ ...s, liveCount: j.count ?? 0, liveSellers: j.sellers ?? [] }));
      } catch {
        // Uden tal viser menuen bare ingen tæller.
      }
    };
    void loadLive();
    const timer = window.setInterval(loadLive, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!hasSupabase) {
      setState((s) => ({ ...s, signedIn: false }));
      return;
    }
    const sb = getSupabase();
    let alive = true;
    const load = async (uid: string | null) => {
      if (!alive) return;
      if (!uid) return setState((s) => ({ ...s, signedIn: false, me: null, cartCount: 0, follows: [] }));
      const [sales, prof, fol] = await Promise.all([
        sb.from("sales").select("id", { count: "exact", head: true }).eq("buyer_id", uid).eq("status", "reserved"),
        sb.from("profiles").select("handle,avatar_path,is_seller").eq("id", uid).maybeSingle(),
        sb
          .from("follows")
          .select("seller:profiles!follows_seller_id_fkey(id,handle,avatar_path)")
          .eq("follower_id", uid)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (!alive) return;
      const follows = fol.error
        ? []
        : ((fol.data ?? []) as unknown as { seller: Followed | null }[]).map((r) => r.seller).filter((x): x is Followed => Boolean(x));
      const me: ShellMe | null = prof.data
        ? {
            id: uid,
            handle: prof.data.handle as string,
            avatar_path: (prof.data.avatar_path as string | null) ?? null,
            is_seller: Boolean(prof.data.is_seller),
          }
        : null;
      setState((s) => ({ ...s, signedIn: true, cartCount: sales.count ?? 0, follows, me }));
    };
    sb.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => load(session?.user.id ?? null));
    // Køb og følg sender "snup:changed", så tallet ved kurven og listen over dem, man følger, er friske.
    const onChange = () => sb.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null));
    window.addEventListener("snup:changed", onChange);
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("snup:changed", onChange);
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
