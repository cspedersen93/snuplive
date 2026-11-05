import Link from "next/link";
import { hasShipmondo } from "@/lib/shipmondo";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type Sb = Awaited<ReturnType<typeof createClient>>;

/**
 * "Kom i gang" øverst i studiet for nye sælgere: de fire ting, der skal være på plads, før man kan sælge og sende.
 * Hvert punkt er et link til stedet, hvor det gøres. Forsvinder, når alt er gjort. Udbetaling og afsenderadresse er kun
 * med, når Stripe og Shipmondo er sat op.
 */
export default async function SellerChecklist({
  supabase,
  uid,
  termsDone,
  hasShows,
}: {
  supabase: Sb;
  uid: string;
  termsDone: boolean;
  hasShows: boolean;
}) {
  const payouts = Boolean(getStripe() && createAdminClient());
  const labels = payouts && hasShipmondo();
  const [acctQ, addrQ] = await Promise.all([
    payouts ? supabase.from("payout_accounts").select("payouts_enabled").eq("user_id", uid).maybeSingle() : Promise.resolve({ data: null }),
    labels ? supabase.from("seller_addresses").select("user_id").eq("user_id", uid).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const steps: { done: boolean; label: string; href: string }[] = [
    { done: termsDone, label: "Bekræft, om du sælger som privatperson eller virksomhed", href: "/konto#saelger" },
    ...(payouts
      ? [{ done: Boolean((acctQ.data as { payouts_enabled?: boolean } | null)?.payouts_enabled), label: "Tilknyt din bankkonto, så du kan få pengene", href: "#udbetaling" }]
      : []),
    ...(labels ? [{ done: Boolean(addrQ.data), label: "Skriv din afsenderadresse til fragtlabels", href: "#afsender" }] : []),
    { done: hasShows, label: "Opret dit første show", href: "#nyt-show" },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (!left) return null;

  return (
    <section className="box checklist" aria-labelledby="h-kom-i-gang">
      <div className="checklist-top">
        <h2 className="h3" id="h-kom-i-gang">Kom i gang som sælger</h2>
        <span className="muted">
          {steps.length - left} af {steps.length} klar
        </span>
      </div>
      <ol className="checklist-steps">
        {steps.map((s) => (
          <li key={s.label} className={s.done ? "done" : ""}>
            <span className="checklist-mark" aria-hidden="true">{s.done ? "✓" : ""}</span>
            {s.done ? <span>{s.label}</span> : <Link href={s.href}>{s.label}</Link>}
            <span className="sr-only">{s.done ? " (klar)" : " (mangler)"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
