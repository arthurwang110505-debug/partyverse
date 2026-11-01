"use client";

import { useRef } from "react";
import { Play } from "lucide-react";
import type { PlayModeId } from "@/types";
import { PLAY_MODES, type PlayMode } from "@/constants/playModes";
import { cn } from "@/lib/utils";

/**
 * Random-party modes, as an accessible radio group.
 *
 * Shared by the draw page, the host lobby and the results screen so the time
 * boxes and the fixed-length battle mode always look and behave the same.
 */
export function PlayModePicker({
  value,
  onChange,
  size = "md",
  disabled = false,
  className,
}: {
  value: PlayModeId | null;
  onChange: (mode: PlayMode) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  const compact = size === "sm";
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  /** Arrow keys move the selection, as the radiogroup pattern expects. */
  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + PLAY_MODES.length) % PLAY_MODES.length;
    onChange(PLAY_MODES[next]);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="派對模式"
      className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}
    >
      {PLAY_MODES.map((mode, index) => {
        const selected = mode.id === value;
        return (
          <button
            key={mode.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (value === null && index === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(mode)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
              compact ? "p-3" : "p-4",
              selected
                ? "border-transparent text-white shadow-lg"
                : "border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10",
            )}
            style={
              selected
                ? { background: mode.gradient, boxShadow: `0 10px 30px -12px ${mode.color}` }
                : undefined
            }
          >
            <span className="flex items-center justify-between gap-2">
              <span className={cn("font-black", compact ? "text-sm" : "text-base")}>
                <span aria-hidden="true" className="mr-1.5">
                  {mode.icon}
                </span>
                {mode.label}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                  selected ? "bg-black/25 text-white" : "bg-white/10 text-white/50",
                )}
              >
                {mode.gameCount ? `${mode.gameCount} 款` : `${mode.budgetMinutes} 分`}
              </span>
            </span>
            {!compact && (
              <>
                <span className={cn("mt-1 block text-[11px] leading-relaxed", selected ? "text-white/90" : "text-white/45")}>
                  {mode.tagline}
                </span>
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 text-[11px] font-semibold",
                    selected ? "text-white" : "text-white/40",
                  )}
                >
                  <Play className="h-3 w-3" aria-hidden="true" />
                  {mode.hint}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
