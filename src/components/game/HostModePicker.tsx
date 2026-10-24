"use client";

import { useRef } from "react";
import { Gamepad2, Monitor, Smartphone } from "lucide-react";
import type { HostMode } from "@/types";
import { HOST_MODES, type HostModePreset } from "@/constants/hostMode";
import { cn } from "@/lib/utils";

/**
 * Pick how this room is presented.
 *
 * Only two real choices: a big screen (today's behaviour) or the host phone.
 * The "我也要一起玩" switch belongs to phone mode only — a TV host can never
 * play from the TV, so showing the switch there would promise something the
 * room does not do.
 */
export function HostModePicker({
  mode,
  hostPlays,
  onChange,
  onHostPlaysChange,
  size = "md",
  disabled = false,
  className,
}: {
  mode: HostMode;
  /** Phone mode only. Ignored (and hidden) for `tv`. */
  hostPlays: boolean;
  onChange: (mode: HostModePreset) => void;
  onHostPlaysChange?: (plays: boolean) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  const compact = size === "sm";
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + HOST_MODES.length) % HOST_MODES.length;
    onChange(HOST_MODES[next]);
    buttons.current[next]?.focus();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div role="radiogroup" aria-label="主持方式" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {HOST_MODES.map((option, index) => {
          const selected = option.id === mode;
          return (
            <button
              key={option.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                compact ? "p-3" : "p-4",
                selected
                  ? "border-transparent bg-white/10 text-white shadow-lg ring-1 ring-white/20"
                  : "border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cn("flex items-center gap-1.5 font-black", compact ? "text-sm" : "text-base")}>
                  <span aria-hidden="true">{option.icon}</span>
                  {option.label}
                </span>
                {selected && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-black"
                    style={{ background: option.color }}
                  >
                    使用中
                  </span>
                )}
              </span>
              <span className={cn("mt-1 block text-[11px] leading-relaxed", selected ? "text-white/80" : "text-white/45")}>
                {option.tagline}
              </span>
              {!compact && (
                <span className={cn("mt-1 block text-[11px] leading-relaxed", selected ? "text-white/60" : "text-white/35")}>
                  {option.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {mode === "phone" ? (
        <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={hostPlays}
              disabled={disabled}
              onChange={(event) => onHostPlaysChange?.(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-violet-400"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                <Gamepad2 className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
                我也要一起玩
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-violet-100/70">
                主持手機同時當你的手把，可以切換「主持畫面」和「我的手把」，不占其他人的名額。
              </span>
            </span>
          </label>
        </div>
      ) : (
        <p className="flex items-start gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-white/50">
          <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
          電視／電腦只顯示主持畫面，不占玩家名額。想下場玩，請再用一支手機掃碼加入。
        </p>
      )}
      {mode === "phone" && !hostPlays && (
        <p className="flex items-start gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-white/50">
          <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden="true" />
          這支手機只負責主持與顯示，不占玩家名額；其他人用手機掃碼加入。
        </p>
      )}
    </div>
  );
}
