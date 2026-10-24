"use client";

import { useCallback, useEffect, useState } from "react";
import type { HostMode } from "@/types";
import { DEFAULT_HOST_MODE, DEFAULT_HOST_PLAYS, HOST_MODE_STORAGE_KEY } from "@/constants/hostMode";
import { defaultHostModeFor, storedHostMode } from "@/lib/hostMode";

interface Stored {
  mode?: unknown;
  hostPlays?: unknown;
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(HOST_MODE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/**
 * The host's choice of how to present the room, remembered on this device.
 *
 * The first render is always the TV default so the server and client markup
 * match; the device-aware default (phone on a narrow touch device) is applied
 * after mount, and an explicit earlier choice always wins over it.
 */
export function useHostModeChoice() {
  const [mode, setMode] = useState<HostMode>(DEFAULT_HOST_MODE);
  const [hostPlays, setHostPlays] = useState(DEFAULT_HOST_PLAYS);

  useEffect(() => {
    const stored = readStored();
    const measured = { width: window.innerWidth, isTouchDevice: matchMedia("(pointer: coarse)").matches };
    setMode(storedHostMode(stored?.mode, measured));
    if (typeof stored?.hostPlays === "boolean") setHostPlays(stored.hostPlays);
  }, []);

  const persist = useCallback((next: { mode: HostMode; hostPlays: boolean }) => {
    try {
      localStorage.setItem(HOST_MODE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode — the room still works, the choice just is not remembered */
    }
  }, []);

  const chooseMode = useCallback(
    (next: HostMode) => {
      setMode(next);
      persist({ mode: next, hostPlays });
    },
    [hostPlays, persist],
  );

  const chooseHostPlays = useCallback(
    (next: boolean) => {
      setHostPlays(next);
      persist({ mode, hostPlays: next });
    },
    [mode, persist],
  );

  /** What `createRoom` needs. The toggle is meaningless outside phone mode. */
  const options = { hostMode: mode, hostPlays: mode === "phone" ? hostPlays : false };

  return { mode, hostPlays, chooseMode, chooseHostPlays, options };
}
