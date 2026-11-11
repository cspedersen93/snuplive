"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";

/** Sælgeren sletter sit eget opslag (og billederne i det). Spørger først. */
export default function PostDelete({ id, images }: { id: string; images: string[] }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const sb = getSupabase();
    const { error } = await sb.from("posts").delete().eq("id", id);
    if (error) {
      setBusy(false);
      return toast(errorText(error, "Opslaget kunne ikke slettes."));
    }
    if (images.length) await sb.storage.from("covers").remove(images);
    toast("Opslaget er slettet");
    router.refresh();
  }

  if (!ask) return <button type="button" className="linkbtn post-del" onClick={() => setAsk(true)}>Slet</button>;
  return (
    <span className="post-del-ask">
      <button type="button" className="btn btn-line btn-sm" onClick={remove} disabled={busy}>{busy ? "Sletter …" : "Slet opslaget"}</button>
      <button type="button" className="linkbtn" onClick={() => setAsk(false)} disabled={busy}>Fortryd</button>
    </span>
  );
}
