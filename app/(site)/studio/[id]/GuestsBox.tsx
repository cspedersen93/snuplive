"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { MAX_GUESTS, type Guest } from "@/lib/guests";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/**
 * Gæst i showet. Værten inviterer op til 2 sælgere med et link og kan tage dem ud igen.
 * Gæsten ser, hvem der er med, og kan forlade showet.
 */
export default function GuestsBox({
  showId,
  isHost,
  host,
  guests,
  meId,
  ended,
  onChanged,
  onLeft,
}: {
  showId: string;
  isHost: boolean;
  host: { handle: string; avatar_path: string | null };
  guests: Guest[];
  meId: string;
  ended: boolean;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<string | null>(null);

  async function invite(renew = false) {
    setBusy(true);
    const { data, error } = await getSupabase().rpc("guest_invite", { p_show: showId, p_renew: renew });
    setBusy(false);
    if (error || typeof data !== "string") return toast(errorText(error ?? new Error("Linket kunne ikke laves.")));
    setLink(`${window.location.origin}/gaest/${data}`);
    if (renew) toast("Der er lavet et nyt link. Det gamle virker ikke længere.");
  }

  async function copy() {
    if (!link) return;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "Vær med i mit show på Relived", url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast("Linket er kopieret. Send det til den sælger, du vil have med.");
    } catch {
      // Brugeren lukkede delingsmenuen, eller browseren må ikke kopiere. Linket står i feltet.
    }
  }

  async function remove(g: Guest) {
    setBusy(true);
    const r = await fetch(`/api/shows/${showId}/guests`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guestId: g.id }),
    });
    setBusy(false);
    setAsk(null);
    if (!r.ok) {
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      return toast(j?.error ?? "Gæsten kunne ikke tages ud. Prøv igen.");
    }
    toast(`@${g.handle} er ikke med i showet længere.`);
    onChanged();
  }

  async function leave() {
    setBusy(true);
    const { error } = await getSupabase().rpc("guest_leave", { p_show: showId });
    setBusy(false);
    setAsk(null);
    if (error) return toast(errorText(error));
    toast(`Du har forladt @${host.handle}s show.`);
    onLeft();
  }

  const room = MAX_GUESTS - guests.length;
  return (
    <div className="box guests-box">
      <div className="guests-head">
        <h2>{isHost ? "Gæster i showet" : "Med i showet"}</h2>
        {isHost ? <span className="muted">{guests.length} af {MAX_GUESTS}</span> : null}
      </div>
      <ul className="guests-list">
        {!isHost ? (
          <li>
            <Avatar handle={host.handle} path={host.avatar_path} size={32} />
            <span>
              <b>@{host.handle}</b> <span className="muted">vært</span>
            </span>
          </li>
        ) : null}
        {guests.map((g) => (
          <li key={g.id}>
            <Avatar handle={g.handle} path={g.avatar_path} size={32} />
            <span>
              <b>{g.id === meId ? "Dig" : `@${g.handle}`}</b> <span className="muted">gæst</span>
            </span>
            {isHost && !ended ? (
              ask === g.id ? (
                <span className="guests-ask">
                  <button className="linkbtn danger" type="button" onClick={() => remove(g)} disabled={busy}>Ja, fjern</button>
                  <button className="linkbtn" type="button" onClick={() => setAsk(null)}>Nej</button>
                </span>
              ) : (
                <button className="linkbtn" type="button" onClick={() => setAsk(g.id)} aria-label={`Fjern @${g.handle} fra showet`}>Fjern</button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {isHost && !ended ? (
        room > 0 ? (
          link ? (
            <div className="guests-link">
              <label className="sr-only" htmlFor="guest-link">Link til gæsten</label>
              <input id="guest-link" value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
              <div className="guests-row">
                <button className="btn btn-red btn-sm" type="button" onClick={copy}>Send linket</button>
                <button className="linkbtn" type="button" onClick={() => invite(true)} disabled={busy}>Lav et nyt link</button>
              </div>
              <p className="fine">Sælgeren, der åbner linket, kommer med som gæst. Del det kun med dem, du vil have med.</p>
            </div>
          ) : (
            <>
              <p className="fine">
                Sælg sammen med {guests.length ? "endnu en sælger" : "op til 2 andre sælgere"}. Gæsten er på kameraet sammen med
                dig, lægger sine egne ting i køen og får selv pengene for dem. Du styrer, hvad der vises.
              </p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => invite(false)} disabled={busy} style={{ alignSelf: "flex-start" }}>
                + Inviter en sælger
              </button>
            </>
          )
        ) : (
          <p className="fine">Showet er fuldt. Tager du en gæst ud, kan du invitere en anden.</p>
        )
      ) : null}
      {!isHost && !ended ? (
        ask === "leave" ? (
          <div className="guests-ask">
            <span className="fine">Forlad showet? Dine ting i køen kommer til salg, når showet slutter.</span>
            <button className="btn btn-line btn-sm" type="button" onClick={leave} disabled={busy}>Ja, forlad showet</button>
            <button className="linkbtn" type="button" onClick={() => setAsk(null)}>Bliv</button>
          </div>
        ) : (
          <button className="linkbtn" type="button" onClick={() => setAsk("leave")} style={{ alignSelf: "flex-start" }}>Forlad showet</button>
        )
      ) : null}
    </div>
  );
}
