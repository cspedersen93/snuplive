import type { Metadata } from "next";
import AuthPage from "@/components/AuthPage";

export const metadata: Metadata = {
  title: { absolute: "Opret konto – køb og sælg live | Relived" },
  description: "Opret en gratis konto på Relived med din e-mail, og begynd at købe eller sælge brugte varer live på video.",
  alternates: { canonical: "/opret" },
};

export default function Opret() {
  return <AuthPage mode="opret" />;
}
