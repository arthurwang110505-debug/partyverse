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
      if (item !== null) {
        try {
          const parsed = JSON.parse(item);
          if (typeof initialValue === "string") {
            // When a string is expected, ensure we never set a non-string:
            // if parsed is a string, use it;
            // if parsed is a number or boolean, coerce to string;
            // otherwise (objects, arrays, null) ignore or fallback.
            if (typeof parsed === "string") {
              setStoredValue(parsed as T);
            } else if (typeof parsed === "number" || typeof parsed === "boolean") {
              setStoredValue(String(parsed) as T);
            } else {
              setStoredValue(initialValue);
            }
          } else {
            setStoredValue(parsed as T);
          }
        } catch {
          // If JSON.parse fails (e.g. unquoted raw string previously saved)
          if (typeof initialValue === "string") {
            setStoredValue(item as T);
          }
        }
      }
    } catch {
      // Storage unavailable or corrupt — keep the initial value.
    }
  }, [key, initialValue]);

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
