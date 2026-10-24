"use client";

import { useEffect, useState } from "react";

interface WakeLockSentinelLike {
  released?: boolean;
  release: () => Promise<void>;
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/**
 * Keep the screen awake while this tab is the room's stage.
 *
 * The phone host replaces the TV, so a phone that dims after 30 seconds ends the
 * shared screen for everybody. The Wake Lock API is used when the browser has
 * it (Chrome/Edge/Android; Safari 16.4+); elsewhere the lobby shows a manual
 * reminder instead of pretending. Locks are dropped whenever the page becomes
 * hidden, so we re-request on every return to the foreground.
 */
export function useScreenWakeLock(enabled = true) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined") return;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) return;
    setSupported(true);

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const request = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await wakeLock.request("screen");
      } catch {
        // Battery saver, unsupported surface, or a denied permission: the room
        // still works, the screen may dim.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [enabled]);

  return { supported };
}
