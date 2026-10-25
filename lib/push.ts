import webpush from "web-push";
import { COMPANY } from "@/lib/company";
import { unquoteEnv } from "@/lib/env";
import type { createAdminClient } from "@/lib/supabase/admin";

// Besked på telefonen (web push). Nøglerne (VAPID) laves automatisk første gang og gemmes i databasen,
// hvor kun serveren kan læse dem. De kan også sættes i Vercel (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Keys = { publicKey: string; privateKey: string };

let cached: Keys | null = null;

export async function vapidKeys(admin: Admin): Promise<Keys | null> {
  if (cached) return cached;
  const pub = unquoteEnv(process.env.VAPID_PUBLIC_KEY);
  const priv = unquoteEnv(process.env.VAPID_PRIVATE_KEY);
  if (pub && priv) return (cached = { publicKey: pub, privateKey: priv });
  const read = async () => {
    const { data, error } = await admin.from("app_secrets").select("value").eq("key", "vapid").maybeSingle();
    if (error) return undefined; // 0016_foelg.sql er ikke kørt endnu
    if (!data?.value) return null;
    try {
      const k = JSON.parse(data.value as string) as Keys;
      return k.publicKey && k.privateKey ? k : null;
    } catch {
      return null;
    }
  };
  let k = await read();
  if (k === undefined) return null;
  if (!k) {
    const fresh = webpush.generateVAPIDKeys();
    // To servere kan nå at lave nøgler samtidig. Den første vinder, og alle læser den bagefter.
    await admin.from("app_secrets").upsert({ key: "vapid", value: JSON.stringify(fresh) }, { onConflict: "key", ignoreDuplicates: true });
    k = await read();
  }
  return k ? (cached = k) : null;
}

// Kun de kendte push-tjenester (Google, Apple, Mozilla, Microsoft). Serveren sender ikke til andre adresser.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

export function pushEndpointAllowed(endpoint: string) {
  try {
    const u = new URL(endpoint);
    const test = (unquoteEnv(process.env.PUSH_TEST_HOSTS) || "").split(",").map((h) => h.trim()).filter(Boolean);
    if (test.includes(u.host)) return true;
    return u.protocol === "https:" && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Sender beskeden til brugernes telefoner/browsere. Giver de brugere, der fik den på mindst én enhed. */
export async function sendPush(admin: Admin, userIds: string[], msg: PushMessage, ttlSeconds = 2 * 3600): Promise<Set<string>> {
  const delivered = new Set<string>();
  const ids = [...new Set(userIds)];
  if (!ids.length) return delivered;
  const keys = await vapidKeys(admin);
  if (!keys) return delivered;

  type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
  const subs: Sub[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", ids.slice(i, i + 200));
    if (error) return delivered;
    subs.push(...((data ?? []) as Sub[]));
  }

  const payload = JSON.stringify(msg);
  const gone: string[] = [];
  const options = {
    vapidDetails: { subject: `mailto:${COMPANY.email}`, publicKey: keys.publicKey, privateKey: keys.privateKey },
    TTL: ttlSeconds,
    urgency: "high" as const,
    timeout: 10_000,
  };
  // Højst 10 ad gangen.
  for (let i = 0; i < subs.length; i += 10) {
    await Promise.all(
      subs.slice(i, i + 10).map(async (s) => {
        if (!pushEndpointAllowed(s.endpoint)) return void gone.push(s.id);
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options);
          delivered.add(s.user_id);
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // Telefonen har slået beskeder fra, eller abonnementet er udløbet.
          if (code === 404 || code === 410) gone.push(s.id);
          else console.error("[relived] besked på telefonen fejlede", code ?? "", (e as Error).message?.slice(0, 120));
        }
      }),
    );
  }
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  return delivered;
}
