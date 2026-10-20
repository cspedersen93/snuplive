import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Åbner sælgerens egen Stripe-oversigt (udbetalinger og bankkonto). */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const stripe = getStripe();
  const admin = createAdminClient();
  const uid = await getUserId(await createClient());
  if (!stripe || !admin || !uid) return NextResponse.redirect(new URL("/studio", origin), 303);
  const { data } = await admin.from("payout_accounts").select("stripe_account_id").eq("user_id", uid).maybeSingle();
  if (!data) return NextResponse.redirect(new URL("/api/stripe/connect", origin), 303);
  try {
    const link = await stripe.accounts.createLoginLink(data.stripe_account_id as string);
    return NextResponse.redirect(link.url, 303);
  } catch {
    return NextResponse.redirect(new URL("/api/stripe/connect", origin), 303);
  }
}
