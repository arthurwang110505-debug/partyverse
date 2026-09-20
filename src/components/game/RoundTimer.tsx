"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RoundTimerProps {
  timeLeft: number;
  /** Total seconds this phase started with — the bar drains from full. */
  total: number;
  /** Announcement said aloud when time runs out, e.g. "投票時間到". */
  endLabel?: string;
  className?: string;
  /** Render a compact version (used inside shells, not the big TV board). */
  compact?: boolean;
}

/**
 * Number + draining bar, with screen-reader announcements.
 *
 * A per-second countdown can't be `aria-live` (it would announce every tick
 * and drown everything), so the visual bar is quiet and a sr-only companion
 * announces only the milestones: 10s, 5s, and time-up.
 */
export function RoundTimer({ timeLeft, total, endLabel = "時間到", className, compact = false }: RoundTimerProps) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (timeLeft / total) * 100)) : 0;
  const critical = timeLeft <= 5;

  const [announcement, setAnnouncement] = useState("");
  const lastAnnounced = useRef(-1);
  useEffect(() => {
    const milestone = timeLeft === 10 || timeLeft === 5 ? timeLeft : timeLeft === 0 ? 0 : -1;
    if (milestone >= 0 && milestone !== lastAnnounced.current) {
      lastAnnounced.current = milestone;
      setAnnouncement(milestone === 0 ? endLabel : `剩 ${milestone} 秒`);
    }
  }, [timeLeft, endLabel]);

  return (
    <div className={cn("w-full", className)}>
      {/* The visual countdown is decorative-only; the announcer below speaks it. */}
      <div aria-hidden="true">
        <div className={cn("flex items-end justify-between gap-3", compact ? "mb-1" : "mb-2")}>
          <span
            className={cn(
              "font-black tabular-nums leading-none transition-colors",
              compact ? "text-2xl" : "text-4xl",
              critical ? "text-red-400" : "text-white",
            )}
          >
            {timeLeft}
          </span>
          <span className="text-xs font-medium text-white/40">秒</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-1000 ease-linear",
              critical ? "bg-gradient-to-r from-red-500 to-orange-400" : "[background:var(--game-accent,#a855f7)]",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}
