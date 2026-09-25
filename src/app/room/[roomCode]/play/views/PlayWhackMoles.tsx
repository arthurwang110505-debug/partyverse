"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { MolesGameState } from "@/engine/whackMoles";
import { COMBO_SIZE, isMoleUp } from "@/engine/whackMoles";
import { serverNow } from "@/engine/clock";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate } from "@/lib/sound";

export default function PlayWhackMoles() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as MolesGameState | undefined;
  const hunting = state?.phase === "hunting";
  const [now, setNow] = useState(() => serverNow());
  const [flash, setFlash] = useState<{ cell: number; hit: boolean; at: number } | null>(null);
  useEffect(() => {
    if (!hunting) return;
    const t = setInterval(() => setNow(serverNow()), 80);
    return () => clearInterval(t);
  }, [hunting]);

  if (!state || !player) return null;
  const spawns = (state.spawns ?? []).filter(Boolean);
  const upIndex = (cell: number) => spawns.findIndex((s) => s.cell === cell && isMoleUp(s, now));
  const myHits = state.hits[player.id] ?? 0;
  const myStreak = state.streaks[player.id] ?? 0;

  const whack = async (cell: number) => {
    if (!hunting) return;
    const t = serverNow();
    const spawn = spawns.findIndex((s) => s.cell === cell && !s.hitBy && t >= s.startAt - 250 && t < s.endAt + 450);
    setFlash({ cell, hit: spawn >= 0, at: t });
    vibrate(spawn >= 0 ? 30 : 10);
    try {
      await submitAction({ type: "whack", cell, ...(spawn >= 0 ? { spawn } : {}) });
    } catch {
      // Drop it; the next tap still lands.
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="flex flex-1 flex-col items-center px-4 py-5 text-center">
        {state.phase === "round_intro" && (
          <>
            <p className="mb-3 text-6xl animate-bounce" aria-hidden="true">🪵</p>
            <h1 className="text-2xl font-black text-white">第 {state.currentRound} 回合，準備…</h1>
            <p className="mt-2 text-sm text-white/60">木頭冒出來（手機和大螢幕同步）就立刻點它！</p>
            <div className="mt-6">
              <RoundTimer timeLeft={state.timeLeft} total={3} endLabel="開始！" compact />
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
              {Array.from({ length: 9 }, (_, cell) => {
                const up = upIndex(cell) >= 0;
                const fb = flash && flash.cell === cell && now - flash.at < 350 ? flash : null;
                return (
                  <button
                    key={cell}
                    type="button"
                    aria-label={`敲第 ${Math.floor(cell / 3) + 1} 排第 ${cell % 3 + 1} 個洞${up ? "（木頭）" : ""}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      void whack(cell);
                    }}
                    className={`flex aspect-square touch-manipulation select-none items-center justify-center rounded-2xl border-2 text-4xl transition-all active:scale-90 ${
                      fb ? (fb.hit ? "border-emerald-300 bg-emerald-500/40" : "border-red-400/60 bg-red-500/20") : up ? "border-amber-300 bg-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.45)]" : "border-white/15 bg-white/5"
                    }`}
                  >
                    {fb?.hit ? "💥" : up ? "🪵" : <span className="opacity-30">🕳️</span>}
                  </button>
                );
              })}
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
