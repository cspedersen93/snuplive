import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { isToken } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bekræft din tilmelding", robots: { index: false } };

/** Linket fra bekræftelsesmailen lander her. */
export default async function Bekraeft({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const t = (await searchParams).t;
  let role: string | null = null;
  if (isToken(t)) {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin.from("waitlist").select("id,role,confirmed_at").eq("confirm_token", t).maybeSingle();
      if (data) {
        if (!data.confirmed_at) await admin.from("waitlist").update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null }).eq("id", data.id);
        role = data.role;
      }
    }
  }
  return (
    <section className="sec">
      <div className="wrap soon-msg">
        {role ? (
          <>
            <span className="label red">Du er med</span>
            <h1 className="h2">Tak! Du står nu på listen.</h1>
            <p className="lede">
              Vi sender dig en mail, når Relived åbner.
              {role !== "buyer" ? " Du har skrevet dig op som sælger, så vi kontakter dig før åbningen og hjælper dig med dit første show." : ""}
            </p>
          </>
        ) : (
          <>
            <span className="label red">Linket virker ikke</span>
            <h1 className="h2">Vi kunne ikke finde din tilmelding</h1>
            <p className="lede">Linket er måske skrevet forkert. Skriv dig op igen, så får du en ny mail.</p>
          </>
        )}
        <div className="ctas">
          <Link className="btn btn-line" href="/">Til forsiden</Link>
        </div>
      </div>
    </section>
  );
}
