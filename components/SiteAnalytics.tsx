"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Statistik over besøg med Vercel Web Analytics: ingen cookies, og der gemmes intet i browseren.
// Vi sender kun siden uden ?-delen af adressen, og sider med login, konto og backoffice tæller vi ikke.
const SKIP = /^\/(auth|login|konto|kurv|admin|studio)(\/|$)/;

function clean(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const u = new URL(event.url);
    if (SKIP.test(u.pathname)) return null;
    u.search = "";
    u.hash = "";
    return { ...event, url: u.toString() };
  } catch {
    return null;
  }
}

export default function SiteAnalytics() {
  return <Analytics beforeSend={clean} />;
}
