"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

const WORDS = ["", "Dårlig", "Ikke så god", "Okay", "God", "Rigtig god"];

/** Bedøm sælgeren med 1–5 stjerner og en kort kommentar, når handlen er afsluttet. */
export default function RateSeller({ orderId, handle }: { orderId: string; handle: string }) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!stars) return toast("Vælg, hvor mange stjerner du vil give.");
    setBusy(true);
    const { error } = await getSupabase().rpc("rate_seller", { p_order: orderId, p_stars: stars, p_comment: comment.trim() || null });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(`Tak! Din bedømmelse af ${handle} er gemt.`);
    router.refresh();
  }

  return (
    <form className="rate-form" onSubmit={send}>
      <fieldset className="stars">
        <legend>Hvordan var handlen med {handle}?</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={n <= stars ? "on" : ""}>
            <input type="radio" name={`stars-${orderId}`} value={n} checked={stars === n} onChange={() => setStars(n)} />
            <span aria-hidden="true">★</span>
            <span className="sr-only">{n} {n === 1 ? "stjerne" : "stjerner"}</span>
          </label>
        ))}
        <span className="stars-word" aria-live="polite">{WORDS[stars]}</span>
      </fieldset>
      {stars ? (
        <>
          <label className="sr-only" htmlFor={`rate-c-${orderId}`}>Kommentar (valgfri)</label>
          <textarea
            id={`rate-c-${orderId}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
            placeholder="Skriv gerne et par ord (valgfrit)"
            rows={2}
          />
          <button className="btn btn-line btn-sm" type="submit" disabled={busy} style={{ alignSelf: "flex-start" }}>
            {busy ? "Gemmer …" : "Gem bedømmelse"}
          </button>
        </>
      ) : null}
    </form>
  );
}
