"use client";

import { usePathname } from "next/navigation";
import SideNav from "@/components/shell/SideNav";
import TabBar from "@/components/shell/TabBar";
import InstallBanner from "@/components/app/InstallBanner";

/** Live-shows og studiet får den smalle menu, så videoen og chatten har pladsen. */
const COMPACT = /^\/(live\/[^/]+|studio|gaest)(\/|$)/;

/**
 * App-rammen: menuen i venstre side på computeren, siden i midten og menulinjen i bunden på telefonen.
 * Selve siderne er de samme som før; de står bare i rammen.
 */
/** `launched`: efter lanceringen er sælg-knapperne neutrale for købere, så køberknapperne står tydeligst. */
export default function AppShell({ children, launched = false }: { children: React.ReactNode; launched?: boolean }) {
  const path = usePathname();
  return (
    <>
      <div className={`app${COMPACT.test(path) ? " app-compact" : ""}`}>
        <SideNav launched={launched} />
        <div className="app-main">{children}</div>
      </div>
      <TabBar launched={launched} />
      <InstallBanner />
    </>
  );
}
