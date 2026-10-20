import { NextResponse } from "next/server";
import { syncPayoutAccount } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Sælgeren kommer tilbage fra Stripe: vi henter status med det samme. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const stripe = getStripe();
  const admin = createAdminClient();
  const supabase = await createClient();
  const uid = await getUserId(supabase);
  if (stripe && admin && uid) {
    const { data } = await admin.from("payout_accounts").select("stripe_account_id").eq("user_id", uid).maybeSingle();
    if (data) {
      try {
        const acct = await syncPayoutAccount(admin, stripe, data.stripe_account_id as string);
        return NextResponse.redirect(new URL(`/studio?udbetaling=${acct.payouts_enabled ? "klar" : "mangler"}`, origin), 303);
      } catch {
        // falder igennem
      }
    }
  }
  return NextResponse.redirect(new URL("/studio?udbetaling=mangler", origin), 303);
}
