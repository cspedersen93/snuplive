import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Billederne på en sag ligger i en lukket mappe. Serveren laver links, der virker i en time. */
export async function signIssuePhotos(admin: Admin, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await admin.storage.from("issues").createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** Billeder pr. sag (0038_klage_bevis.sql). Uden filen: ingen billeder. */
export async function issuePhotos(admin: Admin, issueIds: string[]): Promise<Record<string, string[]>> {
  if (!issueIds.length) return {};
  const { data, error } = await admin.from("order_issues").select("id,photos").in("id", issueIds);
  if (error) return {};
  const rows = (data ?? []) as unknown as { id: string; photos: string[] | null }[];
  const urls = await signIssuePhotos(admin, rows.flatMap((r) => r.photos ?? []));
  const out: Record<string, string[]> = {};
  for (const r of rows) out[r.id] = (r.photos ?? []).map((p) => urls[p]).filter(Boolean);
  return out;
}

export interface PartyHistory {
  /** Ordrer i alt (betalt, sendt, afsluttet eller refunderet). */
  orders: number;
  /** Sager i alt, den her med. */
  issues: number;
  /** Heraf sager, der endte med, at køberen fik pengene tilbage. */
  refunded: number;
}

/** Hvor mange ordrer og sager en køber og en sælger har haft. Bruges, når en sag skal afgøres. */
export async function partyHistory(admin: Admin, side: "buyer" | "seller", ids: string[]): Promise<Record<string, PartyHistory>> {
  const out: Record<string, PartyHistory> = {};
  const uniq = [...new Set(ids)];
  if (!uniq.length) return out;
  const col = side === "buyer" ? "buyer_id" : "seller_id";
  const { data } = await admin
    .from("orders")
    .select(`${col},issues:order_issues!order_issues_order_id_fkey(resolution)`)
    .in(col, uniq)
    .in("status", ["paid", "shipped", "completed", "refunded"])
    .limit(5000);
  for (const id of uniq) out[id] = { orders: 0, issues: 0, refunded: 0 };
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const h = out[row[col] as string];
    if (!h) continue;
    h.orders += 1;
    const issues = (row.issues ?? []) as { resolution: string | null }[];
    h.issues += issues.length;
    h.refunded += issues.filter((i) => i.resolution === "refunded").length;
  }
  return out;
}

/** Fx "3 køb, 2 sager (1 endte med refusion)". */
export function historyText(h: PartyHistory | undefined, noun: "køb" | "salg"): string {
  if (!h) return "";
  const sager = h.issues === 1 ? "1 sag" : `${h.issues} sager`;
  const ref = h.refunded ? ` (${h.refunded} endte med refusion)` : "";
  return `${h.orders} ${noun}, ${sager}${ref}`;
}
