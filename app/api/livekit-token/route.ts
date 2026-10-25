import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { hasSupabase, livekitUrl, unquoteEnv } from "@/lib/env";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Giver adgang til videoen i et show.
 * Sælgeren og gæsterne i showet må sende video (også før showet starter, så kameraet kan testes).
 * Alle andre må kun se med, og kun mens showet er live.
 */
export async function POST(req: Request) {
  const url = livekitUrl(process.env.LIVEKIT_URL);
  const key = unquoteEnv(process.env.LIVEKIT_API_KEY);
  const secret = unquoteEnv(process.env.LIVEKIT_API_SECRET);
  if (!hasSupabase) return fail("Databasen er ikke sat op endnu.", 503);
  const missing: string[] = [];
  if (!url)
    missing.push(
      process.env.LIVEKIT_URL
        ? "LIVEKIT_URL er ikke en gyldig adresse (den skal ligne wss://dit-projekt.livekit.cloud)"
        : "LIVEKIT_URL mangler",
    );
  if (!key) missing.push("LIVEKIT_API_KEY mangler");
  if (!secret) missing.push("LIVEKIT_API_SECRET mangler");
  if (missing.length) {
    console.error(`[livekit-token] ${missing.join("; ")}`);
    return fail(`Video er ikke sat op endnu: ${missing.join(", ")}. Ret det i Vercel, og lav en ny deployment.`, 503);
  }

  const body = (await req.json().catch(() => null)) as { showId?: unknown } | null;
  const showId = typeof body?.showId === "string" ? body.showId : "";
  if (!UUID.test(showId)) return fail("Ukendt show.", 400);

  const supabase = await createClient();
  const uid = await getUserId(supabase);
  const { data: show } = await supabase.from("shows").select("id,seller_id,status").eq("id", showId).maybeSingle();
  if (!show) return fail("Showet findes ikke.", 404);

  const isSeller = Boolean(uid) && uid === show.seller_id;
  // Gæster i showet (0020_gaester.sql) sender også video, ligesom værten.
  let isGuest = false;
  if (uid && !isSeller) {
    const { data: g, error: gErr } = await supabase.rpc("is_show_guest", { p_show: show.id, p_user: uid });
    isGuest = !gErr && g === true;
  }
  const canPublish = isSeller || isGuest;
  if (canPublish ? show.status === "ended" : show.status !== "live") {
    return fail(show.status === "ended" ? "Showet er slut." : "Showet er ikke startet endnu.", 409);
  }

  let name = "Gæst";
  if (uid) {
    const { data: p } = await supabase.from("profiles").select("handle").eq("id", uid).maybeSingle();
    if (p?.handle) name = p.handle as string;
  }
  // Seere får et unikt id pr. fane, så to faner ikke smider hinanden ud.
  // Værten er "seller:<id>", gæsterne er "cohost:<id>". Seerne kan se, hvis kamera der er hvis.
  const identity = isSeller
    ? `seller:${uid}`
    : isGuest
      ? `cohost:${uid}`
      : `${uid ? `user:${uid}` : "guest"}:${crypto.randomUUID().slice(0, 8)}`;

  const at = new AccessToken(key, secret, { identity, name, ttl: "4h" });
  at.addGrant({
    room: show.id,
    roomJoin: true,
    canSubscribe: true,
    canPublish,
    // Reaktioner (hjerter og effekter) sendes over videoforbindelsen. Seerne sender kun til værten, og værtens side
    // bremser og samler dem (se lib/reactions.ts). Ukendte beskeder bliver kasseret.
    canPublishData: true,
    canUpdateOwnMetadata: false,
  });

  return NextResponse.json(
    { token: await at.toJwt(), url, identity },
    { headers: { "Cache-Control": "no-store" } },
  );
}
