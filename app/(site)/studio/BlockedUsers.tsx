import Avatar from "@/components/Avatar";
import { dayLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { UnblockButton } from "./OrderActions";

interface Row {
  user_id: string;
  created_at: string;
  user: { handle: string; avatar_path: string | null } | null;
}

/** De brugere, sælgeren har blokeret i sine shows. Vises kun, hvis der er nogen. */
export default async function BlockedUsers({ uid }: { uid: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_blocks")
    .select("user_id,created_at,user:profiles!seller_blocks_user_id_fkey(handle,avatar_path)")
    .eq("seller_id", uid)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return null;
  return (
    <div className="box">
      <h2 className="h3" style={{ marginBottom: 4 }}>Blokerede brugere</h2>
      <p className="muted" style={{ fontSize: ".9rem", marginBottom: 6 }}>
        De kan ikke skrive i chatten eller købe i dine shows. Du blokerer fra beskedens menu i chatten.
      </p>
      <ul className="list">
        {rows.map((r) => (
          <li key={r.user_id} style={{ gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 12 }}>
            <Avatar handle={r.user?.handle ?? "?"} path={r.user?.avatar_path} />
            <div>
              <strong>@{r.user?.handle ?? "bruger"}</strong>
              <span>Blokeret {dayLabel(r.created_at).toLowerCase()}</span>
            </div>
            <UnblockButton userId={r.user_id} handle={r.user?.handle ?? "brugeren"} />
          </li>
        ))}
      </ul>
    </div>
  );
}
