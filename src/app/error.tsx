"use client";

import { useEffect } from "react";

/**
 * Catches render/runtime errors in the route segment below the root layout.
 * Without this, any throw surfaced Next's full-screen dev overlay in production
 * or a blank page.
 */
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[partyverse] Unhandled route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-4 text-center text-white">
      <p className="mb-4 text-6xl" aria-hidden="true">
        💥
      </p>
      <h1 className="mb-2 text-3xl font-bold">出了點問題</h1>
      <p lang="en" className="mb-2 max-w-md text-white/50">
        Something went wrong on this page.
      </p>
      {error.digest && (
        <p className="mb-6 font-mono text-xs text-white/30" lang="en">
          reference: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90"
      >
        再試一次
      </button>
    </main>
  );
}
