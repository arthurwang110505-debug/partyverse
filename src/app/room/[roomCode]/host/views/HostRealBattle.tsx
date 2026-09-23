"use client";

import { engineRoom } from "@/engine/participants";

import { useEffect } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { BattleGameState } from "@/engine/realBattle";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

export default function HostRealBattle() {
  const { room } = useRoom();
  const state = room?.gameState as BattleGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const phase = state?.phase;
  const timeLeft = state?.timeLeft;

  useEffect(() => {
    if (phase === "countdown") {
      sfx.playTick(700, 0.1);
    } else if (phase === "battle" && timeLeft !== undefined && timeLeft <= 5 && timeLeft > 0) {
      sfx.playTick(1000, 0.08);
    } else if (phase === "result") {
      sfx.playFanfare();
    }
  }, [phase, timeLeft]);

  if (!state) return null;

  const rankedPlayers = Object.entries(state.currentScores ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <HostShell>
      {state.phase === "result" && <Confetti />}

      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-4">
          <p className="mb-1 text-sm font-semibold tracking-wider text-orange-400">大亂鬥 ⚔️ · 即時手機手把對決</p>
          <h1 className="text-2xl font-black text-white md:text-4xl">搶奪金幣與星星！撞開對手、搶下 10 分大星星！</h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Arena Stage */}
          <div
            className="md:col-span-3 relative mx-auto aspect-square w-full max-w-xl overflow-hidden rounded-3xl border-2 border-orange-500/40 bg-slate-950 shadow-2xl"
            role="img"
            aria-label="大亂鬥競技場"
          >
            {/* Arena Items */}
            {state.items.map((item) => (
              <div
                key={item.id}
                className={
                  item.type === "mega"
                    ? "absolute -translate-x-1/2 -translate-y-1/2 animate-bounce text-4xl drop-shadow-[0_0_12px_rgba(250,204,21,0.9)] transition-all"
                    : "absolute -translate-x-1/2 -translate-y-1/2 animate-pulse text-2xl transition-all"
                }
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                aria-hidden="true"
              >
                {item.type === "mega" ? "🌟" : item.type === "star" ? "⭐" : "🪙"}
                {item.type === "mega" && (
                  <span className="absolute -inset-3 rounded-full border-2 border-yellow-400/60 animate-ping" aria-hidden="true" />
                )}
              </div>
            ))}

            {/* Players */}
            {Object.entries(state.positions).map(([id, pos]) => {
              const p = players[id];
              return (
                <div
                  key={id}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-300 ease-linear"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <div
                    className="text-3xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.9)] animate-pulse"
                    aria-hidden="true"
                  >
                    {p?.avatar ?? "👾"}
                  </div>
                  <span className="mt-0.5 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black text-white shadow">
                    {p?.nickname} ({state.currentScores?.[id] ?? 0})
                  </span>
                </div>
              );
            })}

            {state.phase === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/75">
                <span className="animate-bounce text-9xl font-black text-yellow-400 drop-shadow-2xl" role="status">
                  {state.timeLeft}
                </span>
              </div>
            )}

            {state.phase === "battle" && (
              <div className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-black/70 px-4 py-1.5 shadow-lg">
                <span className="text-xl font-black tabular-nums text-orange-400" aria-hidden="true">
                  ⏳ {state.timeLeft} 秒
                </span>
              </div>
            )}

            {state.phase === "result" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 animate-scale-in">
                <span className="text-7xl mb-2 animate-bounce">🏆</span>
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">亂鬥王者誕生</span>
                <h2 className="text-3xl font-black text-white mt-1">
                  {state.winnerId ? players[state.winnerId]?.nickname : "平手"} 橫掃戰場！
                </h2>
                <p className="text-sm text-yellow-200/80 mt-1">
                  斬獲最高分 {state.currentScores?.[state.winnerId ?? ""] ?? 0} 分！
                </p>
              </div>
            )}
          </div>

          {/* Live Leaderboard Sidebar */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left space-y-2 h-full flex flex-col justify-center">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400 block mb-2 text-center">
              🏆 即時積分榜
            </span>
            {rankedPlayers.map(([id, score], idx) => {
              const p = players[id];
              return (
                <div
                  key={id}
                  className={`flex items-center justify-between p-2 rounded-xl text-sm ${
                    idx === 0
                      ? "bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 font-bold"
                      : "bg-white/5 text-white/80"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs opacity-60 w-4 font-mono">{idx + 1}</span>
                    <span>{p?.avatar}</span>
                    <span className="truncate">{p?.nickname}</span>
                  </div>
                  <span className="font-mono font-black text-orange-300 ml-2">{score}</span>
                </div>
              );
            })}
          </div>
        </div>

        <HostGameControls />
      </div>
    </HostShell>
  );
}
