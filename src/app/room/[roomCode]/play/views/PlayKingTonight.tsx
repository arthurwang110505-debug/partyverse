"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { KingGameState } from "@/engine/kingTonight";
import { Button } from "@/components/ui/Button";

export default function PlayKingTonight() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as KingGameState | undefined;
  const [taps, setTaps] = useState(0);

  if (!state || !player) return null;

  const challenge = state.challenge;
  const myInput = state.playerInputs?.[player.id];

  const handleTap = async () => {
    setTaps((t) => t + 1);
    try {
      await submitAction({ type: "tap" });
    } catch {
      // Ignore
    }
  };

  const handleMath = async (ans: string) => {
    try {
      await submitAction({ type: "choice", answer: ans });
    } catch {
      // Ignore
    }
  };

  return (
    <div className="mx-auto max-w-md text-center p-4">
      <header className="mb-4">
        <span className="text-xs uppercase tracking-wider text-yellow-400 font-bold block mb-1">
          今晚誰是王 · 第 {state.currentRound} 回合
        </span>
        <h2 className="text-xl font-black text-white">{challenge?.title}</h2>
      </header>

      {state.phase === "briefing" && (
        <div className="py-12">
          <p className="text-5xl mb-3">⚔️</p>
          <p className="text-base text-white/70">{challenge?.instruction}</p>
        </div>
      )}

      {state.phase === "action" && challenge?.type === "tap_mash" && (
        <div className="py-4">
          <button
            onClick={() => void handleTap()}
            className="w-48 h-48 rounded-full bg-gradient-to-tr from-yellow-500 to-red-500 text-white font-black text-4xl shadow-2xl active:scale-90 transition-transform mx-auto flex flex-col items-center justify-center border-4 border-yellow-300"
          >
            <span>點！</span>
            <span className="text-sm font-normal mt-1 opacity-80">{taps} 次</span>
          </button>
          <p className="text-xs text-white/50 mt-4">用最快速度瘋狂狂按！</p>
        </div>
      )}

      {state.phase === "action" && challenge?.type === "reaction_tap" && (
        <div className="py-4">
          <button
            onClick={() => void handleTap()}
            className="w-full h-44 rounded-3xl bg-emerald-500 text-white font-black text-4xl shadow-xl active:scale-95 transition-transform flex items-center justify-center"
          >
            {myInput !== undefined ? "已斬出！⚡" : "斬！！！"}
          </button>
        </div>
      )}

      {state.phase === "action" && challenge?.type === "emoji_math" && (
        <div className="py-4 space-y-3">
          <p className="text-sm text-white/70 mb-2">🍎 + 🍌 = 5，🍎 = 2，🍌 = ？</p>
          <div className="grid grid-cols-3 gap-2">
            {["2", "3", "4"].map((ans) => (
              <Button
                key={ans}
                variant="ghost"
                size="md"
                disabled={myInput !== undefined}
                onClick={() => void handleMath(ans)}
                className="text-2xl font-bold py-6"
              >
                {ans}
              </Button>
            ))}
          </div>
        </div>
      )}

      {state.phase === "reveal" && (
        <div className="py-8">
          <p className="text-5xl mb-2">🏆</p>
          <p className="text-lg font-bold text-yellow-400">
            {state.roundWinnerId === player.id ? "🎉 你奪得了王位！" : "看大螢幕公布王者！"}
          </p>
        </div>
      )}
    </div>
  );
}
