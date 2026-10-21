import Link from "next/link";

/** Kort link til, hvordan listerne er sorteret (forbrugeraftaleloven § 8 a). */
export default function SortNote() {
  return (
    <p className="sort-note">
      Nyeste først. Ingen kan betale sig til en bedre plads. <Link href="/saadan-virker-det#sortering">Sådan sorterer vi</Link>
    </p>
  );
}
