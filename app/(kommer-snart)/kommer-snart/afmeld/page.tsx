import type { Metadata } from "next";
import Link from "next/link";
import { isToken } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Afmeld mails fra Relived", robots: { index: false } };

/** Afmelding fra ventelisten. Kræver et tryk, så programmer, der åbner links i mails, ikke afmelder folk ved en fejl. */
export default async function Afmeld({ searchParams }: { searchParams: Promise<{ t?: string; ok?: string; fejl?: string }> }) {
  const sp = await searchParams;
  return (
    <section className="sec">
      <div className="wrap soon-msg">
        {sp.ok ? (
          <>
            <span className="label red">Afmeldt</span>
            <h1 className="h2">Du får ikke flere mails fra os</h1>
            <p className="lede">Du er taget af listen. Skifter du mening, kan du altid skrive dig op igen.</p>
          </>
        ) : isToken(sp.t) && !sp.fejl ? (
          <>
            <span className="label red">Afmeld</span>
            <h1 className="h2">Vil du afmelde dig?</h1>
            <p className="lede">Så får du ikke en mail, når Relived åbner, og heller ikke nyheder fra os.</p>
            <form method="post" action="/api/venteliste/afmeld">
              <input type="hidden" name="t" value={sp.t} />
              <button className="btn btn-red" type="submit">Ja, afmeld mig</button>
            </form>
          </>
        ) : (
          <>
            <span className="label red">Linket virker ikke</span>
            <h1 className="h2">Vi kunne ikke finde din tilmelding</h1>
            <p className="lede">Skriv til kontakt@relived.dk, så afmelder vi dig.</p>
          </>
        )}
        <div className="ctas">
          <Link className="btn btn-line" href="/">Til forsiden</Link>
        </div>
      </div>
    </section>
  );
}
