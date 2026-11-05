import { CAMPAIGN_SETTINGS, type CampaignFlags } from "@/lib/campaigns";
import { createPublicClient } from "@/lib/supabase/public";

// Kontakterne i Backoffice → Nyhedsbrev: nyhedsbrevet på forsiden, Green Friday og julekalenderen.
// Huskes 15 sekunder. Kan de ikke læses, er alt slået fra, så intet bliver vist ved en fejl.

const TTL = 15_000;
const OFF: CampaignFlags = { home: false, gf: false, jk: false };
let cache: { value: CampaignFlags; at: number } | null = null;

export async function campaignFlags(): Promise<CampaignFlags> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  let value = OFF;
  try {
    const sb = createPublicClient();
    if (sb) {
      const keys = Object.values(CAMPAIGN_SETTINGS);
      const { data, error } = await sb.from("settings").select("key,value").in("key", keys);
      if (!error && data) {
        const on = (k: string) => data.some((r) => r.key === k && r.value === true);
        value = { home: on(CAMPAIGN_SETTINGS.home), gf: on(CAMPAIGN_SETTINGS.gf), jk: on(CAMPAIGN_SETTINGS.jk) };
      }
    }
  } catch {
    value = OFF;
  }
  cache = { value, at: Date.now() };
  return value;
}

export function clearCampaignFlags() {
  cache = null;
}
