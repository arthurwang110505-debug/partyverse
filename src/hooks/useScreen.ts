"use client";

import { useEffect, useState } from "react";

/**
 * Live viewport size. Starts at 0×0 on the server so the markup is identical on
 * both sides of hydration, then measures on mount and on every resize.
 */
export function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const measure = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  return size;
}

/**
 * True below `breakpoint`. The previous version snapshotted `window.innerWidth`
 * once in a `useState` initialiser and never listened for resize, so rotating a
 * phone or resizing a desktop window left it permanently wrong.
 */
export function useIsMobile(breakpoint = 768) {
  const { width } = useWindowSize();
  // `width === 0` is the pre-hydration state; report desktop there so the first
  // paint matches the server.
  return width > 0 && width < breakpoint;
}

export type ScreenMode = "mobile" | "tablet" | "tv";

/** PartyVerse is played phone-in-hand with a big screen in the room. */
export function useScreenMode(): ScreenMode {
  const { width } = useWindowSize();
  if (width >= 1280) return "tv";
  if (width >= 768) return "tablet";
  return "mobile";
}
