import Link from "next/link";
import { feeFreeDay, feeFreeCopy } from "@/lib/feeFree";

/**
 * Noten om gratis-kampagnen: "0 kr i gebyr for køber og sælger til og med 9. maj 2027".
 * Vises kun, mens kampagnen er i gang (Backoffice → Indstillinger).
 */
export default async function FreeNote() {
  const free = await feeFreeCopy();
  if (!free.active || !free.until) return null;
  return (
    <p className="free-note">
      <span>0 kr i gebyr for køber og sælger til og med {feeFreeDay(free.until)}.</span>
      <Link href="/saadan-virker-det#priser">Se vilkår</Link>
    </p>
  );
}
