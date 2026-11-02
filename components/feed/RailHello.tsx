"use client";

import Link from "next/link";
import { useShell } from "@/components/shell/ShellContext";

/** Til nye besøgende (ikke logget ind): hvad Relived er, og hvordan man kommer i gang. */
export default function RailHello() {
  const { signedIn } = useShell();
  if (signedIn !== false) return null;
  return (
    <section className="rail-box rail-hello" aria-labelledby="h-rail-hello">
      <h2 className="rail-h" id="h-rail-hello">
        Ny på Relived?
      </h2>
      <ol className="rail-steps">
        <li>Se varen live på video, og spørg sælgeren i chatten.</li>
        <li>Køb med ét tryk, byd i budsalg, eller giv et bud.</li>
        <li>Alt fra samme sælger kommer i én pakke.</li>
      </ol>
      <Link className="btn btn-red btn-block" href="/opret">
        Opret gratis konto
      </Link>
      <Link className="rail-link" href="/login">
        Har du en konto? Log ind
      </Link>
    </section>
  );
}
