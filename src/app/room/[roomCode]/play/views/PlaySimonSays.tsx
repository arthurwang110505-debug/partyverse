"use client";

import { useRoom } from "@/providers/RoomContext";
import { SIMON_QUADRANTS, simonSequence } from "@/engine/simonSays";
import type { SimonGameState } from "@/engine/simonSays";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

const BUTTON_STYLES = [
  "border-cyan-300 bg-cyan-400/90 active:bg-cyan-300",
  "border-pink-400 bg-pink-500/90 active:bg-pink-400",
  "border-amber-300 bg-amber-400/90 active:bg-amber-300",
  "border-emerald-300 bg-emerald-400/90 active:bg-emerald-300",
];

export default function PlaySimonSays() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as SimonGameState | undefined;

  if (!state || !player) return null;
  const seq = simonSequence(state.seqSeed, state.level);
  const iAmOut = state.outThisRound.includes(player.id);
  const iAmMaxed = state.maxedOut.includes(player.id);
  const progress = iAmOut ? 0 : state.playerProgress[player.id] ?? 0;
  const repeat = state.phase === "repeat";

  const tap = async (quadrant: number) => {
    if (!repeat || iAmOut || iAmMaxed) return;
    vibrate(25);
    try {
      await submitAction({ type: "tap", quadrant });
    } catch {
      // The sequence keeps running; try again quickly.
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 輪 · Lv.${state.level}`}>
      <div className="flex flex-1 flex-col items-center px-4 py-6 text-center">
        {state.phase === "learning" && (
          <>
            <p className="mb-4 text-6xl" aria-hidden="true">👀</p>
            <h1 className="text-2xl font-black text-white">盯緊大螢幕！</h1>
            <p className="mt-2 text-sm text-white/60">
              有 {state.level} 格顏色順序，等下要你照順序點出來。
            </p>
            {iAmMaxed && <p className="mt-4 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-300">你已達滿級，稍作休息 ✨</p>}
          </>
        )}

        {state.phase === "repeat" && !iAmOut && (
          <>
            <p className="mb-1 text-sm font-bold tracking-wider text-indigo-300">
              照順序點 · {progress}/{seq.length}
            </p>
            {iAmMaxed ? (
              <p className="mt-6 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-300">你已達滿級，稍作休息 ✨</p>
            ) : (
              <div className="mt-4 grid w-full max-w-xs grid-cols-2 gap-3">
                {Array.from({ length: SIMON_QUADRANTS }, (_, q) => (
                  <button
                    key={q}
                    type="button"
                    aria-label={`色塊 ${q + 1}`}
                    onClick={() => void tap(q)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-3xl border-4 text-3xl font-black text-black/60 transition-all active:scale-90",
                      BUTTON_STYLES[q],
                    )}
                  >
                    {q + 1}
                  </button>
                ))}
              </div>
            )}
            {!iAmMaxed && (
              <div className="mt-5">
                <RoundTimer timeLeft={state.timeLeft} total={20} endLabel="淘汰" compact />
              </div>
            )}
          </>
        )}

        {state.phase === "repeat" && iAmOut && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">💥</p>
            <h1 className="text-2xl font-black text-red-400">你點錯了，本輪淘汰</h1>
            <p className="mt-2 text-sm text-white/60">分數保留，觀戰其他人能到第幾格！</p>
          </>
        )}

        {state.phase === "round_reveal" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">🔷</p>
            <h1 className="text-2xl font-black text-white">本輪到達 Lv.{state.maxLevelReached}</h1>
            <p className="mt-2 text-sm text-white/60">{iAmOut ? "下輪重新來過，加油！" : "下輪重新來過，序列回到 Lv.3！"}</p>
          </>
        )}

        {state.phase === "result" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">{state.winnerId === player.id ? "👑" : "🔷"}</p>
            <h1 className="text-2xl font-black text-white">
              {state.winnerId === player.id ? "你就是記憶之王！" : "比賽結束！"}
            </h1>
            <p className="mt-2 text-sm text-white/60">排名看大螢幕。</p>
          </>
        )}
      </div>
    </PlayShell>
  );
}
