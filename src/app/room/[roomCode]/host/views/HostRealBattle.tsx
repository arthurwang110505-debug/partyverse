"use client";

import { useRoom } from "@/providers/RoomContext";
import type { BattleGameState } from "@/engine/realBattle";
import { Button } from "@/components/ui/Button";

export default function HostRealBattle() {
  const { room, endRound, endGame } = useRoom();
  const state = room?.gameState as BattleGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  return (
    <div className="mx-auto max-w-4xl text-center">
      <header className="mb-4">
        <p className="text-sm text-orange-400 font-semibold mb-1">
          大亂鬥 ⚔️ · 即時手機手把對決
        </p>
        <h1 className="text-2xl md:text-4xl font-black text-white">
          搶奪金幣與星星！
        </h1>
      </header>

      {/* Arena Stage */}
      <div className="relative mx-auto my-4 w-full max-w-xl aspect-square bg-slate-950 border-2 border-orange-500/40 rounded-3xl overflow-hidden shadow-2xl">
        {/* Arena Items */}
        {state.items.map((item) => (
          <div
            key={item.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 text-2xl animate-pulse"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            {item.type === "star" ? "⭐" : "🪙"}
          </div>
        ))}

        {/* Players */}
        {Object.entries(state.positions).map(([id, pos]) => {
          const p = players[id];
          return (
            <div
              key={id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-100"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                {p?.avatar ?? "👾"}
              </div>
              <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded-full mt-0.5">
                {p?.nickname} ({state.currentScores?.[id] ?? 0})
              </span>
            </div>
          );
        })}

        {state.phase === "countdown" && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <span className="text-8xl font-black text-yellow-400 animate-bounce">{state.timeLeft}</span>
          </div>
        )}

        {state.phase === "battle" && (
          <div className="absolute top-4 right-4 bg-black/60 px-4 py-2 rounded-full border border-white/10">
            <span className="text-2xl font-black tabular-nums text-orange-400">{state.timeLeft} 秒</span>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3 mt-4">
        <Button variant="ghost" size="md" onClick={() => void endRound()}>重開</Button>
        <Button variant="danger" size="md" onClick={() => void endGame()}>結算</Button>
      </div>
    </div>
  );
}
