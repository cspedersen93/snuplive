"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBell } from "@/components/Icons";
import { hasSupabase } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/** "Husk mig": en mail, når showet starter. Kan sættes på hele showet eller én ting i det. */
export default function RemindButton({ showId, itemId = null, next, className = "btn btn-line" }: { showId: string; itemId?: string | null; next: string; className?: string }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasSupabase) return setUid(null);
    const sb = getSupabase();
    let alive = true;
    sb.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id ?? null;
      if (!alive) return;
      setUid(id);
      if (!id) return;
      let q = sb.from("reminders").select("id").eq("show_id", showId);
      q = itemId ? q.eq("item_id", itemId) : q.is("item_id", null);
      const { data: rows } = await q.limit(1);
      if (alive) setOn(Boolean(rows?.length));
    });
    return () => {
      alive = false;
    };
  }, [showId, itemId]);

  if (uid === null) {
    return (
      <Link className={className} href={`/login?next=${encodeURIComponent(next)}`}>
        <IconBell width={18} height={18} />
        Husk mig
      </Link>
    );
  }

  async function toggle() {
    if (!uid) return;
    setBusy(true);
    const sb = getSupabase();
    if (on) {
      let q = sb.from("reminders").delete().eq("user_id", uid).eq("show_id", showId);
      q = itemId ? q.eq("item_id", itemId) : q.is("item_id", null);
      const { error } = await q;
      setBusy(false);
      if (error) return toast(errorText(error));
      setOn(false);
      toast("Du får ikke besked om det her show.");
    } else {
      const { error } = await sb.from("reminders").insert({ user_id: uid, show_id: showId, item_id: itemId });
      setBusy(false);
      if (error && !/duplicate/i.test(error.message)) return toast(errorText(error));
      setOn(true);
      toast("Vi giver dig besked, når showet starter.");
    }
  }

  return (
    <button className={`${className}${on ? " is-on" : ""}`} type="button" onClick={toggle} disabled={busy || uid === undefined} aria-pressed={on}>
      <IconBell width={18} height={18} />
      {on ? "Du bliver husket" : "Husk mig"}
    </button>
  );
}
