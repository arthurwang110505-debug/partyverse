"use client";

import { useEffect, useState } from "react";

export function useWindowSize() {
  const [size, setSize] = useState({ width: typeof window !== "undefined" ? window.innerWidth : 0, height: typeof window !== "undefined" ? window.innerHeight : 0 });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
}

export function useIsMobile(breakpoint = 768) {
  const [isMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  return isMobile;
}

export function useScreenMode() {
  const { width } = useWindowSize();
  if (width >= 1280) return "tv" as const;
  if (width >= 768) return "tablet" as const;
  return "mobile" as const;
}
