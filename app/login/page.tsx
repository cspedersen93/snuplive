import type { Metadata } from "next";
import AuthPage from "@/components/AuthPage";

export const metadata: Metadata = {
  title: "Log ind",
  description: "Log ind på SnupLive med din e-mail og kom i gang med at købe og sælge brugte ting live.",
  robots: { index: false },
};

export default function Login() {
  return <AuthPage mode="login" />;
}
