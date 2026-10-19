"use client";

import { useEffect, useState } from "react";
import { hasSupabase } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";

export interface Me {
  id: string;
  handle: string;
}

/** Den indloggede bruger i browseren (null = ikke logget ind, undefined = henter). */
export function useMe() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    if (!hasSupabase) return setMe(null);
    const sb = getSupabase();
    let alive = true;
    const load = async (uid: string | undefined) => {
      if (!uid) return alive && setMe(null);
      const { data } = await sb.from("profiles").select("id,handle").eq("id", uid).maybeSingle();
      if (alive) setMe(data ? { id: data.id as string, handle: data.handle as string } : null);
    };
    sb.auth.getSession().then(({ data }) => load(data.session?.user.id));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => load(s?.user.id));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return me;
}
