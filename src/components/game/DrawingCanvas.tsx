import type { SVGProps } from "react";
import { strokePath, type StrokeLine } from "@/engine/drawAndGuess";

export function DrawingCanvas({
  strokes,
  liveStroke,
  ...props
}: SVGProps<SVGSVGElement> & { strokes: StrokeLine[]; liveStroke?: StrokeLine | null }) {
  const lines = liveStroke ? [...strokes.filter((s) => s.id !== liveStroke.id), liveStroke] : strokes;
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="共享畫布" {...props}>
      {lines.map((stroke, index) => (
        <path
          key={stroke.id ?? index}
          d={strokePath(stroke.points)}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
