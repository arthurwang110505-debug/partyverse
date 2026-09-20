"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Deterministic pseudo-random so server/client/renders agree per index. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9973.13) * 43758.5453;
  return x - Math.floor(x);
}

const PIECES = 28;
const COLORS = ["#a855f7", "#00f0ff", "#ff2d95", "#facc15", "#ffffff"];

/**
 * A ~1-second celebration burst for the results screen, zero dependencies.
 * Skipped entirely under `prefers-reduced-motion`.
 */
export function Confetti() {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDone(true), 2600);
    return () => window.clearTimeout(t);
  }, []);

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        id: i,
        left: pseudoRandom(i + 1) * 100,
        size: 6 + pseudoRandom(i + 11) * 8,
        delay: pseudoRandom(i + 21) * 0.5,
        duration: 1.4 + pseudoRandom(i + 31) * 0.9,
        color: COLORS[i % COLORS.length],
        rotate: pseudoRandom(i + 41) * 720 - 360,
        drift: pseudoRandom(i + 51) * 80 - 40,
      })),
    [],
  );

  if (reduceMotion || done) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: -24, opacity: 1, rotate: 0 }}
          animate={{ x: p.drift, y: "105vh", opacity: [1, 1, 0.6], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          className="absolute top-0 rounded-sm"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.6, background: p.color }}
        />
      ))}
    </div>
  );
}
