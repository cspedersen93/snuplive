import { createHash } from "crypto";
import { unquoteEnv } from "@/lib/env";

// MitID via Idura (OpenID Connect). Sæt IDURA_DOMAIN, IDURA_CLIENT_ID og IDURA_CLIENT_SECRET i Vercel.
// IDURA_DOMAIN er domænet fra Idura, fx "relived-test.idura.broker" (test) eller jeres eget produktionsdomæne.

/** Middel sikkerhed (MitID "substantial"), som Idura anbefaler. */
export const MITID_ACR = "urn:grn:authn:dk:mitid:substantial";
export const MITID_COOKIE = "snup_mitid";

export function mitidConfig() {
  const domain = unquoteEnv(process.env.IDURA_DOMAIN).trim().replace(/\/+$/, "");
  const clientId = unquoteEnv(process.env.IDURA_CLIENT_ID).trim();
  const secret = unquoteEnv(process.env.IDURA_CLIENT_SECRET).trim();
  if (!domain || !clientId || !secret) return null;
  const base = /^https?:\/\//.test(domain) ? domain : `https://${domain}`;
  return { base, clientId, secret };
}

export const mitidEnabled = () => mitidConfig() !== null;

/** Vi gemmer kun et hash af MitID-id'et, så det samme MitID ikke kan bruges på flere konti. */
export function subHash(sub: string) {
  return createHash("sha256").update(`snuplive:mitid:${sub}`).digest("hex");
}

/** Hvor man sendes hen efter MitID. Kun stier på vores egen side. */
export function safeNext(raw: string | null | undefined, fallback = "/konto") {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : fallback;
}

export function withParam(path: string, key: string, value: string) {
  const [p, hash] = path.split("#");
  return `${p}${p.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
}

export { MITID_RESULT } from "@/lib/mitid-text";

/** Til siderne: er MitID sat op, er det et krav for at gå live, og har sælgeren bekræftet sig? */
export async function mitidState(
  supabase: { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> },
  profile: { mitid_verified_at?: string | null },
) {
  const enabled = mitidEnabled();
  const verified = Boolean(profile.mitid_verified_at);
  let required = false;
  if (enabled) {
    const { data, error } = await supabase.rpc("mitid_required");
    required = !error && data === true;
  }
  return { enabled, required, verified, needed: enabled && required && !verified };
}
