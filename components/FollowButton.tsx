"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PushOffer } from "@/components/PushOffer";
import { hasSupabase } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/**
 * "Følg" en sælger: besked, når sælgeren går live (på telefonen eller som mail), og en mail om morgenen,
 * hvis sælgeren har et show samme dag. Viser også, hvor mange der følger sælgeren.
 */
export default function FollowButton({
  sellerId,
  handle,
  next,
  className = "btn btn-line btn-sm",
  label = "Følg",
}: {
  sellerId: string;
  handle: string;
  next: string;
  className?: string;
  /** Teksten på knappen, før man følger. */
  label?: string;
}) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [on, setOn] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState(false);

  const follow = useCallback(
    async (me: string) => {
      setBusy(true);
      const { error } = await getSupabase().from("follows").insert({ follower_id: me, seller_id: sellerId });
      setBusy(false);
      if (error && !/duplicate/i.test(error.message)) return toast(errorText(error));
      setOn(true);
      if (!error) setCount((c) => (c ?? 0) + 1);
      toast(`Du følger nu @${handle}. Vi giver dig besked, når @${handle} går live.`);
      setOffer(true);
    },
    [sellerId, handle],
  );

  useEffect(() => {
    if (!hasSupabase) return;
    const sb = getSupabase();
    let alive = true;
    (async () => {
      // Antallet står på profilen. Findes det ikke (0016_foelg.sql er ikke kørt), vises knappen ikke.
      const { data: p, error } = await sb.from("profiles").select("follower_count").eq("id", sellerId).maybeSingle();
      if (!alive || error) return;
      setCount((p?.follower_count as number | undefined) ?? 0);
      const { data } = await sb.auth.getSession();
      const me = data.session?.user.id ?? null;
      if (!alive) return;
      setUid(me);
      let following = false;
      if (me && me !== sellerId) {
        const { data: rows } = await sb.from("follows").select("seller_id").eq("seller_id", sellerId).limit(1);
        following = Boolean(rows?.length);
        if (alive) setOn(following);
      }
      if (!alive) return;
      setReady(true);
      // Kom man fra login via "Følg", følger man med det samme.
      if (window.location.hash === "#foelg") {
        history.replaceState(null, "", window.location.pathname + window.location.search);
        if (me && me !== sellerId && !following) void follow(me);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sellerId, follow]);

  if (!ready) return null;
  const countText = count ? `${count.toLocaleString("da-DK")} ${count === 1 ? "følger" : "følgere"}` : null;

  if (uid === sellerId) {
    return countText ? <span className="follow-count">{countText}</span> : null;
  }

  async function unfollow() {
    if (!uid) return;
    setBusy(true);
    const { error } = await getSupabase().from("follows").delete().eq("follower_id", uid).eq("seller_id", sellerId);
    setBusy(false);
    if (error) return toast(errorText(error));
    setOn(false);
    setOffer(false);
    setCount((c) => Math.max(0, (c ?? 1) - 1));
    toast(`Du følger ikke længere @${handle}.`);
  }

  return (
    <div className="follow">
      <div className="follow-row">
        {uid ? (
          <button
            className={`${className}${on ? " is-on" : ""}`}
            type="button"
            aria-pressed={on}
            disabled={busy}
            onClick={() => (on ? unfollow() : follow(uid))}
            title={on ? `Stop med at følge @${handle}` : `Få besked, når @${handle} går live`}
          >
            {on ? "Følger ✓" : label}
          </button>
        ) : (
          <Link className={className} href={`/login?next=${encodeURIComponent(`${next}#foelg`)}`}>
            {label}
          </Link>
        )}
        {countText ? <span className="follow-count">{countText}</span> : null}
      </div>
      {offer ? <PushOffer handle={handle} /> : null}
    </div>
  );
}
