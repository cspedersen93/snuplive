import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { MITID_ACR, MITID_COOKIE, mitidConfig, safeNext, withParam } from "@/lib/mitid";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Sender sælgeren til MitID hos Idura. ?next=/studio fortæller, hvor man kommer tilbage til. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const cfg = mitidConfig();
  if (!cfg) return NextResponse.redirect(new URL(withParam(next, "mitid", "off"), origin));
  const uid = await getUserId(await createClient());
  if (!uid) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, origin));

  const state = randomBytes(18).toString("base64url");
  const nonce = randomBytes(18).toString("base64url");
  const url = new URL(`${cfg.base}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    response_mode: "query",
    client_id: cfg.clientId,
    redirect_uri: `${origin}/api/mitid/callback`,
    scope: "openid",
    acr_values: MITID_ACR,
    state,
    nonce,
    ui_locales: "da",
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set(MITID_COOKIE, JSON.stringify({ state, nonce, next, uid }), {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/mitid",
    maxAge: 600,
  });
  return res;
}
