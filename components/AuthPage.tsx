import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export default function AuthPage({ mode }: { mode: "login" | "opret" }) {
  const opret = mode === "opret";
  return (
    <div className="wrap auth">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <nav className="crumbs" aria-label="Brødkrummer">
          <Link href="/">Forside</Link>
          <span aria-hidden="true">/</span>
          <span>{opret ? "Opret konto" : "Log ind"}</span>
        </nav>
        <h1 className="h1">{opret ? "Opret en gratis konto på Relived" : "Log ind på Relived"}</h1>
        <p className="lede">
          {opret
            ? "Med én konto kan du både købe og sælge. Skriv din e-mail, så sender vi dig et login med det samme."
            : "Skriv din e-mail, så sender vi dig et link og en kode. Har du ikke en konto, bliver den oprettet."}
        </p>
        <ul className="ticks">
          <li>Gratis at oprette</li>
          <li>Køb varer i live-shows med ét tryk</li>
          <li>Gå live fra telefonen eller computeren, direkte i browseren</li>
        </ul>
      </div>
      <div className="auth-card">
        <Suspense fallback={null}>
          <AuthForm cta={opret ? "Opret konto" : "Send login"} />
        </Suspense>
      </div>
    </div>
  );
}
