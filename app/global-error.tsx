"use client";

import "./globals.css";
import ErrorBody from "@/components/ErrorBody";

/** Sidste udvej: fejl i selve rammen om siden. Her skal vi selv levere <html> og <body>. */
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="da">
      <body>
        <title>Noget gik galt | Relived</title>
        <main id="indhold">
          <ErrorBody {...props} />
        </main>
      </body>
    </html>
  );
}
