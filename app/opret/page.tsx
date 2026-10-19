import type { Metadata } from "next";
import AuthPage from "@/components/AuthPage";

export const metadata: Metadata = {
  title: { absolute: "Opret konto – køb og sælg live | SnupLive" },
  description: "Opret en gratis konto på SnupLive med din e-mail, og begynd at købe eller sælge brugte ting live på video.",
  alternates: { canonical: "/opret" },
};

export default function Opret() {
  return <AuthPage mode="opret" />;
}
