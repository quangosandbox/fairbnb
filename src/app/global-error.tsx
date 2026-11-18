"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: "#525252" }}>We&apos;ve been notified and are looking into it.</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#059669", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 600 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
