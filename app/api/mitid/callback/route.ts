import { NextResponse, type NextRequest } from "next/server";
import { MITID_COOKIE, mitidConfig, safeNext, subHash, withParam } from "@/lib/mitid";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Claims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nonce?: string;
  sub?: string;
  name?: string;
  birthdate?: string;
  age?: number | string;
}

/** Læser indholdet af id_token. Vi har selv hentet det direkte fra Idura over HTTPS med vores hemmelige nøgle. */
function readIdToken(token: string): Claims | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Claims;
  } catch {
    return null;
  }
}

function ageFrom(c: Claims) {
  const a = Number(c.age);
  if (Number.isFinite(a) && a > 0) return a;
  if (!c.birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(c.birthdate)) return null;
  const b = new Date(`${c.birthdate}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) years--;
  return years;
}

/** MitID sender sælgeren tilbage hertil. Vi henter svaret hos Idura og gemmer bekræftelsen. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const sp = req.nextUrl.searchParams;
  let saved: { state?: string; nonce?: string; next?: string; uid?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(MITID_COOKIE)?.value ?? "{}");
  } catch {
    saved = {};
  }
  const next = safeNext(saved.next);
  const done = (result: string) => {
    const res = NextResponse.redirect(new URL(withParam(next, "mitid", result), origin));
    res.cookies.set(MITID_COOKIE, "", { path: "/api/mitid", maxAge: 0 });
    return res;
  };

  const cfg = mitidConfig();
  const admin = createAdminClient();
  if (!cfg || !admin) return done("off");
  if (sp.get("error")) return done("afbrudt");
  const code = sp.get("code");
  if (!code || !saved.state || sp.get("state") !== saved.state) return done("fejl");
  const uid = await getUserId(await createClient());
  if (!uid || uid !== saved.uid) return done("fejl");

  let claims: Claims | null = null;
  try {
    const basic = Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.secret)}`).toString("base64");
    const r = await fetch(`${cfg.base}/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${origin}/api/mitid/callback` }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      console.error("[snuplive] MitID token", r.status, (await r.text()).slice(0, 300));
      return done("fejl");
    }
    const j = (await r.json()) as { id_token?: string };
    claims = j.id_token ? readIdToken(j.id_token) : null;
  } catch (e) {
    console.error("[snuplive] MitID token", e);
    return done("fejl");
  }

  // Tjek, at svaret er til os, er nyt og hører til netop dette forsøg.
  const aud = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  if (
    !claims?.sub ||
    !aud.includes(cfg.clientId) ||
    !claims.iss?.startsWith(cfg.base) ||
    !claims.exp ||
    claims.exp * 1000 < Date.now() ||
    (claims.nonce && claims.nonce !== saved.nonce)
  ) {
    console.error("[snuplive] MitID: ugyldigt id_token", { iss: claims?.iss, aud: claims?.aud });
    return done("fejl");
  }
  const age = ageFrom(claims);
  if (age !== null && age < 18) return done("alder");

  const birthdate = claims.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(claims.birthdate) ? claims.birthdate : null;
  const { data, error } = await admin.rpc("admin_set_mitid", {
    p_user: uid,
    p_sub_hash: subHash(claims.sub),
    p_name: claims.name ?? null,
    p_birthdate: birthdate,
  });
  if (error) {
    console.error("[snuplive] MitID gem", error.message);
    return done("fejl");
  }
  return done(data === "taken" ? "brugt" : "ok");
}
