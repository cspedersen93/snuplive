"use client";

import { useCallback, useEffect, useState } from "react";
import { SITE_URL } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/**
 * Lukket show (0026_lukkede_shows.sql): værtens invitationslink. Dem, der åbner linket og logger ind, kommer ind i showet.
 */
export default function ClosedShowBox({ showId, handle }: { showId: string; handle: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [members, setMembers] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const link = code ? `${SITE_URL}/live/${handle}?invite=${code}` : "";

  const load = useCallback(
    async (fresh = false) => {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("show_invite_code", { p_show: showId, p_new: fresh });
      if (error) return toast(errorText(error));
      setCode(data as string);
      const m = await sb.rpc("show_member_count", { p_show: showId });
      if (!m.error) setMembers((m.data as number | null) ?? 0);
    },
    [showId],
  );

  useEffect(() => {
    void load();
    const t = setInterval(async () => {
      const m = await getSupabase().rpc("show_member_count", { p_show: showId });
      if (!m.error) setMembers((m.data as number | null) ?? 0);
    }, 30_000);
    return () => clearInterval(t);
  }, [load, showId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast("Linket er kopieret. Del det med dem, der skal med.");
    } catch {
      toast(link);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Mit lukkede show på Relived", text: "Du er inviteret til mit show på Relived:", url: link });
    } catch {
      // Lukket
    }
  }

  async function renew() {
    if (!window.confirm("Lav et nyt link? Det gamle link holder op med at virke. Dem, der allerede er inde, kan stadig komme ind.")) return;
    setBusy(true);
    await load(true);
    setBusy(false);
    toast("Der er lavet et nyt link.");
  }

  return (
    <div className="box invite-box" data-tour="invite">
      <h2 className="h3">Lukket show</h2>
      <p className="muted" style={{ fontSize: ".9375rem" }}>
        Showet står ikke på siden. Kun dem, der åbner linket og logger ind, kan se med, skrive og købe.
        {members !== null ? ` ${members === 1 ? "1 er" : `${members} er`} inviteret.` : ""}
      </p>
      <div className="invite-row">
        <code>{link || "Laver link …"}</code>
        <button className="btn btn-red btn-sm" type="button" onClick={copy} disabled={!code}>Kopiér link</button>
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <button className="btn btn-line btn-sm" type="button" onClick={share} disabled={!code}>Del</button>
        ) : null}
      </div>
      <button className="linkbtn" type="button" onClick={renew} disabled={busy || !code} style={{ alignSelf: "flex-start" }}>
        Lav et nyt link
      </button>
    </div>
  );
}
