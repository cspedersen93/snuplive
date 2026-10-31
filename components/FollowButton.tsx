"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PushOffer } from "@/components/PushOffer";
import { hasSupabase } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import { track } from "@/lib/track";

/** Flere knapper for samme sælger på siden (fx på videoen og i boksen ved siden af) følger hinanden. */
const SYNC = "relived:follow";
type SyncDetail = { sellerId: string; on: boolean; delta: number; from: string };

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
  compact = false,
  onFollowed,
}: {
  sellerId: string;
  handle: string;
  next: string;
  className?: string;
  /** Teksten på knappen, før man følger. */
  label?: string;
  /**
   * Lille knap (på videoen): uden antal følgere og uden tilbuddet om besked på telefonen.
   * Følger man allerede sælgeren, vises den ikke.
   */
  compact?: boolean;
  /** Kaldes, når man lige er begyndt at følge. */
  onFollowed?: () => void;
}) {
  const self = useId();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [on, setOn] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState(false);
  // Den lille knap bliver stående som "Følger ✓", hvis man lige har trykket på den (ellers skjules den).
  const [just, setJust] = useState(false);
  // I en ref, så en ny funktion fra forælderen ikke får siden til at hente det hele igen.
  const onFollowedRef = useRef(onFollowed);
  useEffect(() => {
    onFollowedRef.current = onFollowed;
  }, [onFollowed]);
  const tell = useCallback(
    (on: boolean, delta: number) =>
      window.dispatchEvent(new CustomEvent<SyncDetail>(SYNC, { detail: { sellerId, on, delta, from: self } })),
    [sellerId, self],
  );

  const follow = useCallback(
    async (me: string) => {
      setBusy(true);
      const { error } = await getSupabase().from("follows").insert({ follower_id: me, seller_id: sellerId });
      setBusy(false);
      if (error && !/duplicate/i.test(error.message)) return toast(errorText(error));
      setOn(true);
      setJust(true);
      if (!error) setCount((c) => (c ?? 0) + 1);
      tell(true, error ? 0 : 1);
      if (!error) track("Følg", { hvor: compact ? "video" : "side" });
      toast(`Du følger nu @${handle}. Vi giver dig besked, når @${handle} går live.`);
      if (!compact) setOffer(true);
      onFollowedRef.current?.();
    },
    [sellerId, handle, tell, compact],
  );

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<SyncDetail>).detail;
      if (!d || d.sellerId !== sellerId || d.from === self) return;
      setOn(d.on);
      if (!d.on) {
        setJust(false);
        setOffer(false);
      }
      if (d.delta) setCount((c) => Math.max(0, (c ?? 0) + d.delta));
    };
    window.addEventListener(SYNC, on);
    return () => window.removeEventListener(SYNC, on);
  }, [sellerId, self]);

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
    return countText && !compact ? <span className="follow-count">{countText}</span> : null;
  }

  async function unfollow() {
    if (!uid) return;
    setBusy(true);
    const { error } = await getSupabase().from("follows").delete().eq("follower_id", uid).eq("seller_id", sellerId);
    setBusy(false);
    if (error) return toast(errorText(error));
    setOn(false);
    setOffer(false);
    setJust(false);
    setCount((c) => Math.max(0, (c ?? 1) - 1));
    tell(false, -1);
    toast(`Du følger ikke længere @${handle}.`);
  }

  if (compact) {
    if (on && !just) return null;
    return uid ? (
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
      <Link className={className} href={`/login?next=${encodeURIComponent(`${next}#foelg`)}`} title={`Log ind, og følg @${handle}`}>
        {label}
      </Link>
    );
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
