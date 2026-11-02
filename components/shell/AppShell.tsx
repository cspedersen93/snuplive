"use client";

import { usePathname } from "next/navigation";
import SideNav from "@/components/shell/SideNav";
import TabBar from "@/components/shell/TabBar";

/** Live-shows og studiet får den smalle menu, så videoen og chatten har pladsen. */
const COMPACT = /^\/(live\/[^/]+|studio|gaest)(\/|$)/;

/**
 * App-rammen: menuen i venstre side på computeren, siden i midten og menulinjen i bunden på telefonen.
 * Selve siderne er de samme som før; de står bare i rammen.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <div className={`app${COMPACT.test(path) ? " app-compact" : ""}`}>
        <SideNav />
        <div className="app-main">{children}</div>
      </div>
      <TabBar />
    </>
  );
}
