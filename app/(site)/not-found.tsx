import type { Metadata } from "next";
import NotFoundBody from "@/components/NotFoundBody";

export const metadata: Metadata = { title: "Siden findes ikke", robots: { index: false } };

/**
 * Når en side inde på Relived ikke findes (fx et show eller en vare, der er væk). Rammen med topbjælke, menu og bund
 * kommer fra app/(site)/layout.tsx, så den står kun én gang.
 */
export default function NotFound() {
  return <NotFoundBody />;
}
