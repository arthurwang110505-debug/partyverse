"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

interface ChristmasContextValue {
  christmasMode: true;
}

const ChristmasContext = createContext<ChristmasContextValue>({
  christmasMode: true,
});

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 7919.17) * 43758.5453;
  return x - Math.floor(x);
}

const FLAKES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: Math.round(pseudoRandom(i + 1) * 96 + 2),
  size: Math.round(10 + pseudoRandom(i + 19) * 10),
  duration: (8 + pseudoRandom(i + 37) * 8).toFixed(2),
  delay: (-pseudoRandom(i + 53) * 10).toFixed(2),
  opacity: (0.28 + pseudoRandom(i + 71) * 0.42).toFixed(2),
  glyph: i % 5 === 0 ? "✨" : i % 3 === 0 ? "❅" : "❄",
}));

function SnowfallOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[45] overflow-hidden select-none"
      aria-hidden="true"
    >
      {FLAKES.map((f) => (
        <span
          key={f.id}
          className="christmas-snowflake absolute -top-8 text-white/80"
          style={{
            left: `${f.left}%`,
            fontSize: `${f.size}px`,
            opacity: Number(f.opacity),
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        >
          {f.glyph}
        </span>
      ))}
    </div>
  );
}

export function ChristmasProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("christmas-mode");
    }
  }, []);

  return (
    <ChristmasContext.Provider value={{ christmasMode: true }}>
      <SnowfallOverlay />
      {children}
    </ChristmasContext.Provider>
  );
}

export function useChristmas() {
  return useContext(ChristmasContext);
}
