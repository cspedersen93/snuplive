import { isAdminEmail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

// Før lanceringen er siden lukket: besøgende ser kun "Kommer snart". Admins (ADMIN_EMAILS) og testere
// (tabellen beta_access, styres i Backoffice → Indstillinger) ser hele siden, når de er logget ind.

const OPEN_TTL = 15_000;
// Testere huskes et minut. Et nej huskes kun kort, så en ny tester kommer ind med det samme.
const TESTER_TTL = 60_000;
const NOT_TESTER_TTL = 5_000;
let openCache: { value: boolean; at: number } | null = null;
const testerCache = new Map<string, { value: boolean; at: number }>();

/** Er siden åben for alle? Kan ikke læses (fx før 0012 er kørt) → åben, så intet går i stykker. */
export async function siteOpen(): Promise<boolean> {
  if (openCache && Date.now() - openCache.at < OPEN_TTL) return openCache.value;
  let value = true;
  try {
    const sb = createPublicClient();
    if (sb) {
      const { data, error } = await sb.from("settings").select("value").eq("key", "site_open").maybeSingle();
      value = error || !data ? true : data.value !== false;
    }
  } catch {
    value = true;
  }
  openCache = { value, at: Date.now() };
  return value;
}

let bannerCache: { value: boolean | null; at: number } | null = null;

/**
 * TESTFASE-bjælken øverst (Backoffice → Indstillinger): true = vis den, false = skjul den, null = automatisk
 * (vises, så længe Stripe kører i testtilstand).
 */
export async function testBannerSetting(): Promise<boolean | null> {
  if (bannerCache && Date.now() - bannerCache.at < OPEN_TTL) return bannerCache.value;
  let value: boolean | null = null;
  try {
    const sb = createPublicClient();
    if (sb) {
      const { data, error } = await sb.from("settings").select("value").eq("key", "test_banner").maybeSingle();
      value = error || !data || typeof data.value !== "boolean" ? null : data.value;
    }
  } catch {
    value = null;
  }
  bannerCache = { value, at: Date.now() };
  return value;
}

export function clearSiteCache() {
  openCache = null;
  bannerCache = null;
  testerCache.clear();
}

async function isTester(email: string) {
  const key = email.toLowerCase();
  const hit = testerCache.get(key);
  if (hit && Date.now() - hit.at < (hit.value ? TESTER_TTL : NOT_TESTER_TTL)) return hit.value;
  let value = false;
  try {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin.from("beta_access").select("email").eq("email", key).maybeSingle();
      value = Boolean(data);
    }
  } catch {
    value = false;
  }
  testerCache.set(key, { value, at: Date.now() });
  return value;
}

/** Må den indloggede bruger se hele siden, mens den er lukket? */
export async function hasEarlyAccess(email: string | null | undefined) {
  if (!email) return false;
  return isAdminEmail(email) || (await isTester(email));
}

/** Sider, alle må se, også mens siden er lukket. API'erne passer selv på, hvem der må hvad. */
export function alwaysOpen(path: string) {
  return (
    path === "/kommer-snart" ||
    path.startsWith("/kommer-snart/") ||
    path === "/login" ||
    path === "/opret" ||
    path.startsWith("/auth/") ||
    path.startsWith("/api/") ||
    path === "/privatliv" ||
    path === "/cookies" ||
    path === "/handelsbetingelser" ||
    path === "/vilkaar" ||
    path === "/om-relived" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml"
  );
}
