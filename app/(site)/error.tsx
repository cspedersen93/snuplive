"use client";

import ErrorBody from "@/components/ErrorBody";

/** Når en side inde på Relived går i stykker. Topbjælke, menu og bund kommer fra app/(site)/layout.tsx. */
export default function SiteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBody {...props} />;
}
