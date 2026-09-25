import type { SVGProps } from "react";
import { strokePath } from "@/engine/drawAndGuess";
import type { FireworkStroke } from "@/engine/fireworkMaster";

/** A glowing, night-sky rendering of a player's hand-drawn firework. */
export function FireworkSketch({
  strokes,
  label = "煙火手繪作品",
  ...props
}: SVGProps<SVGSVGElement> & { strokes: FireworkStroke[]; label?: string }) {
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label={label} {...props}>
      <defs>
        <filter id="fw-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#fw-glow)">
        {strokes.map((s, i) => (
          <path
            key={i}
            d={strokePath(s.p)}
            stroke={s.c}
            strokeWidth={s.w}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
}
