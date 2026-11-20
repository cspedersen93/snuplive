"use client";

import ErrorBody from "@/components/ErrorBody";

/** Fejl på sider uden for den almindelige ramme (fx "Kommer snart" og chatten på stor skærm). */
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="indhold">
      <ErrorBody {...props} />
    </main>
  );
}
