"use client";

import { GAMES } from "@/constants/games";
import { vibrate } from "@/lib/sound";
import { useRoom } from "@/providers/RoomContext";
import { HostShell } from "./HostShell";
import { PlayShell } from "./PlayShell";
import { RoundTimer } from "./RoundTimer";

/**
 * The pre-game rules tour rendered while the engine sits in the shared
 * "rules" phase (see `engine/rulesTour.ts`). The TV is the read-aloud
 * surface; phones show the same rules plus the skip button — any
 * participant can tap "開始遊戲" to start the match early.
 */
export function RulesTour({ variant }: { variant: "host" | "play" }) {
  const { room, submitAction } = useRoom();
  const game = GAMES.find((g) => g.id === room?.gameId);
  const state = room?.gameState as { timeLeft?: number } | undefined;
  const timeLeft = state?.timeLeft ?? 0;
  const rules = game?.rules;

  if (!game || !rules?.length) return null;

  const skip = async () => {
    vibrate(20);
    try {
      await submitAction({ type: "skipRules" });
    } catch {
      // The tour keeps running; the countdown still ends it.
    }
  };

  if (variant === "play") {
    return (
      <PlayShell>
        <div className="flex flex-1 flex-col px-4 py-6 text-center">
          <p className="mb-2 text-5xl" aria-hidden="true">
            {game.icon}
          </p>
          <h1 className="text-2xl font-black text-white">
            {game.name}
            <span className="mt-1 block text-xs font-semibold tracking-widest text-white/50">規則說明</span>
          </h1>

          <ol className="mt-5 flex flex-col gap-2.5 text-left">
            {rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/85">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-black text-white"
                >
                  {i + 1}
                </span>
                {rule}
              </li>
            ))}
          </ol>

          <div className="mt-auto flex flex-col items-center gap-4 pt-6">
            <RoundTimer timeLeft={timeLeft} total={15} endLabel="開始！" compact />
            <button
              type="button"
              onClick={() => void skip()}
              className="w-full max-w-xs rounded-2xl bg-white px-6 py-4 text-base font-black text-black shadow-lg transition-transform active:scale-95"
            >
              開始遊戲 →
            </button>
            <p className="text-[11px] text-white/40">任一玩家按下即可直接開玩</p>
          </div>
        </div>
      </PlayShell>
    );
  }

  return (
    <HostShell>
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
        <p className="mb-4 text-7xl animate-bounce" aria-hidden="true">
          {game.icon}
        </p>
        <h1 className="text-5xl font-black text-white md:text-6xl">{game.name}</h1>
        <p className="mb-8 mt-2 text-sm font-bold tracking-[0.4em] text-white/50">規 則 說 明</p>

        <ol className="flex w-full flex-col gap-4 text-left">
          {rules.map((rule, i) => (
            <li key={i} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg font-black text-white"
              >
                {i + 1}
              </span>
              <span className="text-xl font-medium leading-relaxed text-white/90">{rule}</span>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col items-center gap-2">
          <RoundTimer timeLeft={timeLeft} total={15} endLabel="開始！" className="w-56" />
          <p className="text-sm text-white/45">任一玩家可在手機點「開始遊戲」提前開玩</p>
        </div>
      </div>
    </HostShell>
  );
}
