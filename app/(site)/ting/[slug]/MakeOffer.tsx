"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { kr, when } from "@/lib/format";
import { hasSupabase } from "@/lib/env";
import { OFFER_HOURS, offerMin } from "@/lib/pricing";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import { track } from "@/lib/track";

type MyOffer = { id: string; amount: number; status: string; expires_at: string; created_at: string };

/** Forslag til bud: 90 % og 80 % af prisen, rundet ned til 5 kr. */
function suggestions(price: number) {
  const min = offerMin(price);
  const out = [0.9, 0.8].map((f) => Math.max(min, Math.floor((price * f) / 5) * 5)).filter((v) => v < price);
  return [...new Set(out)];
}

/**
 * Giv et bud på en vare til fast pris (0028_bud_paa_varer.sql): mindst 70 % af prisen. Sælgeren har 48 timer
 * til at svare. Siger hun ja, bliver varen reserveret til køberen og lander i kurven.
 */
export default function MakeOffer({
  itemId,
  price,
  sellerId,
  handle,
  next,
}: {
  itemId: string;
  price: number;
  sellerId: string;
  handle: string;
  next: string;
}) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [mine, setMine] = useState<MyOffer | null>(null);
  const [ready, setReady] = useState(true);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const min = offerMin(price);

  const load = useCallback(async (id: string) => {
    const { data, error } = await getSupabase()
      .from("offers")
      .select("id,amount,status,expires_at,created_at")
      .eq("item_id", itemId)
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return setReady(false);
    setMine((data as MyOffer | null) ?? null);
  }, [itemId]);

  useEffect(() => {
    if (!hasSupabase) return setUid(null);
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        const id = data.session?.user.id ?? null;
        setUid(id);
        if (id && id !== sellerId) void load(id);
      });
  }, [load, sellerId]);

  if (!ready || uid === undefined || uid === sellerId) return null;
  if (uid === null) {
    return (
      <Link className="btn btn-line btn-block offer-open" href={`/login?next=${encodeURIComponent(next)}`}>
        Log ind og giv et bud
      </Link>
    );
  }

  const open_ = mine?.status === "pending" && Date.parse(mine.expires_at) > Date.now() ? mine : null;
  const declined = mine?.status === "declined" ? mine : null;

  async function send(amount: number) {
    if (!Number.isInteger(amount) || amount < min) return toast(`Buddet skal være mindst ${kr(min)}.`);
    if (amount >= price) return toast("Byd under prisen, eller køb varen med Køb nu.");
    setBusy(true);
    try {
      const r = await fetch("/api/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item: itemId, amount }),
      });
      const j = (await r.json().catch(() => ({}))) as { offer?: MyOffer; error?: string };
      if (!r.ok || !j.offer) throw new Error(j.error || "Buddet kunne ikke sendes.");
      setMine(j.offer);
      setOpen(false);
      setValue("");
      track("Bud", { hvor: "fast pris" });
      toast(`Dit bud på ${kr(amount)} er sendt. Du får besked, når ${handle} svarer.`);
    } catch (e) {
      toast(errorText(e));
      if (uid) void load(uid);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!open_) return;
    setBusy(true);
    const { error } = await getSupabase().rpc("withdraw_offer", { p_offer: open_.id });
    setBusy(false);
    if (error) {
      toast(errorText(error));
    } else {
      toast("Dit bud er trukket tilbage.");
    }
    if (uid) void load(uid);
    router.refresh();
  }

  const form = (
    <form
      className="offer-form"
      onSubmit={(e) => {
        e.preventDefault();
        void send(Number(value));
      }}
    >
      <div className="offer-sugg" role="group" aria-label="Forslag til bud">
        {suggestions(price).map((v) => (
          <button key={v} type="button" className="chip-btn" onClick={() => setValue(String(v))} aria-pressed={value === String(v)}>
            {kr(v)}
          </button>
        ))}
      </div>
      <div className="offer-row">
        <div className="field">
          <label htmlFor={`bud-${itemId}`}>Dit bud i kr.</label>
          <input
            id={`bud-${itemId}`}
            inputMode="numeric"
            autoComplete="off"
            placeholder={`Mindst ${min}`}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 7))}
          />
        </div>
        <button className="btn btn-red" type="submit" disabled={busy || !value}>
          {busy ? "Sender …" : value ? `Send bud på ${kr(Number(value))}` : "Send bud"}
        </button>
      </div>
      <p className="fine">
        Mindst {kr(min)}. {handle} har {OFFER_HOURS} timer til at svare. Siger {handle} ja, bliver varen din til buddet, og du betaler under
        Mine køb. <Link href="/saadan-virker-det#bud">Sådan virker bud</Link>
      </p>
    </form>
  );

  if (open_) {
    return (
      <div className="offer-box" role="status">
        <p>
          <b>Dit bud på {kr(open_.amount)}</b> venter på svar fra {handle}. Buddet gælder til {when(open_.expires_at).toLowerCase()}.
        </p>
        {open ? form : null}
        <div className="offer-actions">
          {!open ? (
            <button className="linkbtn" type="button" onClick={() => setOpen(true)} disabled={busy}>
              Skift bud
            </button>
          ) : null}
          <button className="linkbtn" type="button" onClick={withdraw} disabled={busy}>
            Træk buddet tilbage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="offer-box">
      {declined ? (
        <p className="fine" style={{ margin: 0 }}>
          {handle} sagde nej til dit bud på {kr(declined.amount)}.
        </p>
      ) : null}
      {open ? (
        form
      ) : (
        <button className="btn btn-line btn-block offer-open" type="button" onClick={() => setOpen(true)}>
          {declined ? "Giv et nyt bud" : "Giv et bud"}
        </button>
      )}
    </div>
  );
}
