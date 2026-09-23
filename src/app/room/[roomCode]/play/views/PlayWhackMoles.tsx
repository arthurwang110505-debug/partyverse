"use client";

import { useRoom } from "@/providers/RoomContext";
import type { MolesGameState } from "@/engine/whackMoles";
import { COMBO_SIZE } from "@/engine/whackMoles";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate } from "@/lib/sound";

export default function PlayWhackMoles() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as MolesGameState | undefined;

  if (!state || !player) return null;
  const myHits = state.hits[player.id] ?? 0;
  const myStreak = state.streaks[player.id] ?? 0;
  const hunting = state.phase === "hunting";

  const whack = async (cell: number) => {
    if (!hunting) return;
    vibrate(15);
    try {
      await submitAction({ type: "whack", cell });
    } catch {
      // Drop it; the next tap still lands.
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="flex flex-1 flex-col items-center px-4 py-5 text-center">
        {state.phase === "round_intro" && (
          <>
            <p className="mb-3 text-6xl animate-bounce" aria-hidden="true">🐹</p>
            <h1 className="text-2xl font-black text-white">第 {state.currentRound} 回合，準備…</h1>
            <p className="mt-2 text-sm text-white/60">木頭從大螢幕的洞裡冒出來，點「同樣位置」的洞！</p>
            <div className="mt-6">
              <RoundTimer timeLeft={state.timeLeft} total={2} endLabel="開始！" compact />
            </div>
          </>
        )}

        {state.phase === "hunting" && (
          <>
            <div className="mb-3 flex w-full max-w-xs items-center justify-between text-sm font-bold">
              <span className="text-amber-300">本回合 {myHits} 下</span>
              <span className={myStreak >= COMBO_SIZE - 1 ? "animate-pulse text-emerald-300" : "text-white/50"}>
                連擊 {myStreak}
              </span>
            </div>
            <div className="grid w-full max-w-xs grid-cols-3 gap-2.5">
              {Array.from({ length: 9 }, (_, cell) => (
                <button
                  key={cell}
                  type="button"
                  aria-label={`敲第 ${Math.floor(cell / 3) + 1} 排第 ${cell % 3 + 1} 個洞`}
                  onClick={() => void whack(cell)}
                  className="flex aspect-square select-none items-center justify-center rounded-2xl border-2 border-white/15 bg-white/5 text-3xl transition-all active:scale-90 active:bg-amber-400/30"
                >
                  🕳️
                </button>
              ))}
            </div>
            <div className="mt-4">
              <RoundTimer timeLeft={state.timeLeft} total={state.roundDuration} endLabel="本回合結束" compact />
            </div>
          </>
        )}

        {state.phase === "round_reveal" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">🔨</p>
            <h1 className="text-2xl font-black text-white">本回合你敲了 {myHits} 下</h1>
            <p className="mt-2 text-sm text-white/60">累計 {state.totalHits[player.id] ?? 0} 下，準備下一回合…</p>
          </>
        )}

        {state.phase === "result" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">{state.winnerId === player.id ? "👑" : "🔨"}</p>
            <h1 className="text-2xl font-black text-white">
              {state.winnerId === player.id ? "你就是敲木頭之王！" : "比賽結束！"}
            </h1>
            <p className="mt-2 text-sm text-white/60">你總共敲了 {state.totalHits[player.id] ?? 0} 下，詳細排名看大螢幕。</p>
          </>
        )}
      </div>
    </PlayShell>
  );
}
