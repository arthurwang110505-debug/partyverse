"use client";

import { useRoom } from "@/providers/RoomContext";
import type { BattleGameState } from "@/engine/realBattle";

export default function PlayRealBattle() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as BattleGameState | undefined;

  if (!state || !player) return null;

  const handleMove = async (dx: number, dy: number) => {
    try {
      await submitAction({ type: "move", dx, dy });
    } catch {
      // Ignore
    }
  };

  return (
    <div className="mx-auto max-w-md text-center p-4">
      <header className="mb-4">
        <span className="text-xs uppercase tracking-wider text-orange-400 font-bold block mb-1">
          手機手把 · 大亂鬥 ⚔️
        </span>
        <p className="text-sm text-white/70">使用方向鍵操控角色搶奪星星！</p>
      </header>

      <div className="py-6 flex flex-col items-center justify-center gap-3">
        {/* Virtual D-Pad */}
        <button
          onClick={() => void handleMove(0, -1)}
          className="w-20 h-20 rounded-2xl bg-white/10 active:bg-orange-500 border border-white/20 text-3xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center"
        >
          ▲
        </button>
        <div className="flex gap-4">
          <button
            onClick={() => void handleMove(-1, 0)}
            className="w-20 h-20 rounded-2xl bg-white/10 active:bg-orange-500 border border-white/20 text-3xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center"
          >
            ◀
          </button>
          <div className="w-20 h-20 rounded-2xl border border-white/5 bg-white/5 flex items-center justify-center text-xs text-white/40">
            PAD
          </div>
          <button
            onClick={() => void handleMove(1, 0)}
            className="w-20 h-20 rounded-2xl bg-white/10 active:bg-orange-500 border border-white/20 text-3xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center"
          >
            ▶
          </button>
        </div>
        <button
          onClick={() => void handleMove(0, 1)}
          className="w-20 h-20 rounded-2xl bg-white/10 active:bg-orange-500 border border-white/20 text-3xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
