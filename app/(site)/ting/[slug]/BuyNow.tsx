"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { kr } from "@/lib/format";
import { hasSupabase } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import { track } from "@/lib/track";

/** Køb nu: tingen reserveres til dig og lander i Mine køb, hvor du betaler. */
export default function BuyNow({ itemId, price, next, sellerId }: { itemId: string; price: number; next: string; sellerId: string }) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!hasSupabase) return setUid(null);
    getSupabase()
      .auth.getSession()
      .then(({ data }) => setUid(data.session?.user.id ?? null));
  }, []);

  if (uid === null) {
    return (
      <Link className="btn btn-red btn-block" href={`/login?next=${encodeURIComponent(next)}`}>
        Log ind og køb · {kr(price)}
      </Link>
    );
  }
  if (uid === sellerId) {
    return <p className="fine">Det er din egen vare. Du kan rette prisen eller tage den af under Mine shows.</p>;
  }

  async function buy() {
    setBusy(true);
    const { error } = await getSupabase().rpc("buy_now", { p_item: itemId });
    if (error) {
      setBusy(false);
      toast(errorText(error));
      router.refresh();
      return;
    }
    window.dispatchEvent(new Event("snup:changed"));
    track("Køb", { hvor: "fast pris" });
    toast("Den er din! Betal under Mine køb.");
    router.push("/kurv");
  }

  return (
    <button className="btn btn-red btn-block" type="button" onClick={buy} disabled={busy || uid === undefined}>
      {busy ? "Reserverer …" : `Køb nu · ${kr(price)}`}
    </button>
  );
}
