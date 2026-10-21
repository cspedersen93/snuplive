import type { SupabaseClient } from "@supabase/supabase-js";

// Indberetning til Skattestyrelsen efter reglerne om digitale platforme (DAC7).
// En sælger skal indberettes, hvis sælgeren har mindst 30 salg ELLER har solgt for mindst 2.000 euro i løbet af året.

export const DAC7_MIN_SALES = 30;
export const DAC7_MIN_EUR = 2000;
/** Omregningskurs til grænsen. Skattestyrelsen bruger ECB's kurs; kronen ligger fast omkring 7,46. */
export const DKK_PER_EUR = 7.46;
export const DAC7_MIN_DKK = Math.round(DAC7_MIN_EUR * DKK_PER_EUR);

export interface Dac7Row {
  seller_id: string;
  handle: string;
  display_name: string | null;
  email: string | null;
  area: string | null;
  seller_type: "private" | "business" | null;
  business_name: string | null;
  business_cvr: string | null;
  stripe_account_id: string | null;
  sales: number;
  amount: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  fees: number;
}

export const mustReport = (r: Pick<Dac7Row, "sales" | "amount">) => Number(r.sales) >= DAC7_MIN_SALES || Number(r.amount) >= DAC7_MIN_DKK;
/** Tæt på grænsen: halvvejs. Så kan vi bede sælgeren om oplysningerne i god tid. */
export const nearLimit = (r: Pick<Dac7Row, "sales" | "amount">) =>
  !mustReport(r) && (Number(r.sales) >= DAC7_MIN_SALES / 2 || Number(r.amount) >= DAC7_MIN_DKK / 2);

export function dac7Year(raw: string | undefined) {
  const now = new Date().getFullYear();
  const y = Number(raw);
  return Number.isInteger(y) && y >= 2026 && y <= now ? y : now;
}

export async function fetchDac7(admin: SupabaseClient, year: number) {
  const { data, error } = await admin.rpc("admin_dac7", { p_year: year });
  return { rows: ((data ?? []) as Dac7Row[]).map((r) => ({ ...r, sales: Number(r.sales), amount: Number(r.amount) })), error };
}
