import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Sender sælgeren til Stripe for at tilknytte sin bankkonto (opretter kontoen første gang). */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const back = (q: string) => NextResponse.redirect(new URL(`/studio?udbetaling=${q}`, origin), 303);
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return back("ikke-sat-op");

  const supabase = await createClient();
  const user = await getUserInfo(supabase);
  if (!user) return NextResponse.redirect(new URL("/login?next=/studio", origin), 303);
  const { data: profile } = await supabase.from("profiles").select("is_seller").eq("id", user.id).maybeSingle();
  if (!profile?.is_seller) return back("ikke-saelger");

  let { data: acct } = await admin.from("payout_accounts").select("stripe_account_id").eq("user_id", user.id).maybeSingle();
  try {
    if (!acct) {
      const created = await stripe.accounts.create(
        {
          country: "DK",
          email: user.email ?? undefined,
          business_type: "individual",
          controller: {
            stripe_dashboard: { type: "express" },
            fees: { payer: "application" },
            losses: { payments: "application" },
            requirement_collection: "stripe",
          },
          capabilities: { transfers: { requested: true } },
          business_profile: {
            mcc: "5931",
            product_description: "Salg af brugte ting i live-shows på Relived",
          },
          metadata: { snuplive_user: user.id },
        },
        { idempotencyKey: `account-${user.id}` },
      );
      await admin.from("payout_accounts").upsert({ user_id: user.id, stripe_account_id: created.id });
      acct = { stripe_account_id: created.id };
    }
    const link = await stripe.accountLinks.create({
      account: acct.stripe_account_id as string,
      type: "account_onboarding",
      refresh_url: `${origin}/api/stripe/connect`,
      return_url: `${origin}/api/stripe/connect/retur`,
    });
    return NextResponse.redirect(link.url, 303);
  } catch (e) {
    console.error("[snuplive] connect fejlede", e);
    return back("fejl");
  }
}
