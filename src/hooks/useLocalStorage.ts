"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * `useState` + `localStorage` that is safe under SSR.
 *
 * The first render always uses `initialValue` — on the server there is no
 * storage, and reading it during render would make the server HTML disagree
 * with the client's first paint. The stored value is applied in an effect, and
 * writes are guarded so a full or blocked storage (private mode, quota) cannot
 * crash a party mid-game.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) setStoredValue(JSON.parse(item) as T);
    } catch {
      // Storage unavailable or corrupt — keep the initial value.
    }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Ignore write failures; the in-memory value is still updated.
        }
        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
