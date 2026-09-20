"use client";

import type { RoomSettings } from "@/types";
import { gameSettingsProfile } from "@/constants/gameSettings";
import { cn } from "@/lib/utils";

export function RoomSettingsFields({
  gameId,
  settings,
  onChange,
}: {
  gameId: string;
  settings: RoomSettings;
  onChange: (patch: Partial<RoomSettings>) => void;
}) {
  const profile = gameSettingsProfile(gameId);
  return (
    <div className="space-y-5">
      {profile.hasDifficulty && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-white/75">難度</legend>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["easy", "輕鬆"],
                ["medium", "普通"],
                ["hard", "挑戰"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={settings.difficulty === value}
                onClick={() => onChange({ difficulty: value })}
                className={cn(
                  "min-h-11 rounded-xl border px-3 py-2 text-sm",
                  settings.difficulty === value
                    ? "border-violet-400/60 bg-violet-500/20 text-white"
                    : "border-white/10 bg-white/5 text-white/65",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/60">
            {gameId === "drawandguess"
              ? "輕鬆模式半程給首字提示；普通最後四分之一給提示；挑戰使用較長詞彙、不提示首字。"
              : "難度越高，引信越短；連續傳遞會出現更難的題目。"}
          </p>
        </fieldset>
      )}
      {profile.hasTimer && (
        <div>
          <label htmlFor="game-timer" className="mb-2 block text-sm font-medium text-white/75">
            {profile.timerLabel}：<strong className="tabular-nums text-white">{settings.timer}</strong>
          </label>
          <input
            id="game-timer"
            aria-describedby="game-timer-hint"
            type="range"
            min={profile.timerMin}
            max={profile.timerMax}
            value={settings.timer}
            onChange={(e) => onChange({ timer: Number(e.target.value) })}
            className="h-8 w-full accent-violet-400"
          />
          <p id="game-timer-hint" className="text-xs leading-relaxed text-white/60">
            {profile.timerHint}
          </p>
        </div>
      )}
      {profile.maxRounds > 1 && (
        <div>
          <label htmlFor="game-rounds" className="mb-2 block text-sm font-medium text-white/75">
            {profile.roundsLabel}
          </label>
          <select
            id="game-rounds"
            value={settings.rounds}
            onChange={(e) => onChange({ rounds: Number(e.target.value) })}
            className="min-h-11 w-full rounded-xl border border-white/20 bg-[#141522] px-3 py-2 text-base"
          >
            {Array.from({ length: profile.maxRounds }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          {gameId === "drawandguess" && (
            <p className="mt-2 text-xs text-white/60">每輪讓所有在線玩家各畫一次，不會有人被跳過。</p>
          )}
        </div>
      )}
    </div>
  );
}
