"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { KingGameState } from "@/engine/kingTonight";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate } from "@/lib/sound";

export default function PlayKingTonight() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as KingGameState | undefined;
  const [taps, setTaps] = useState(0);

  if (!state || !player) return null;

  const challenge = state.challenge;
  const myInput = state.playerInputs?.[player.id];

  const handleTap = async () => {
    setTaps((t) => t + 1);
    vibrate(8);
    try {
      await submitAction({ type: "tap" });
    } catch {
      toast("操作失敗，請再試一次");
    }
  };

  const handleMath = async (ans: string) => {
    try {
      await submitAction({ type: "choice", answer: ans });
    } catch {
      toast("作答失敗，請再試一次");
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="text-center">
        <header className="mb-4 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-yellow-400">今晚誰是王</span>
          <h2 className="text-xl font-black text-white">{challenge?.title}</h2>
        </header>

        {state.phase === "briefing" && (
          <div className="py-12">
            <p className="mb-3 text-5xl" aria-hidden="true">
              ⚔️
            </p>
            <p className="text-base text-white/70">{challenge?.instruction}</p>
          </div>
        )}

        {state.phase === "action" && challenge?.type === "tap_mash" && (
          <div className="py-4">
            <button
              type="button"
              aria-label={`瘋狂點擊，已點 ${taps} 次`}
              onClick={() => void handleTap()}
              className="mx-auto flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 border-yellow-300 bg-gradient-to-tr from-yellow-500 to-red-500 text-4xl font-black text-white shadow-2xl transition-transform active:scale-90"
            >
              <span>點！</span>
              <span className="mt-1 text-sm font-normal opacity-80">{taps} 次</span>
            </button>
            <p className="mt-4 text-xs text-white/50">用最快速度瘋狂狂按！</p>
          </div>
        )}

        {state.phase === "action" && challenge?.type === "reaction_tap" && (
          <div className="py-4">
            <button
              type="button"
              aria-label={myInput !== undefined ? "已斬出" : "斬"}
              onClick={() => void handleTap()}
              className="flex h-44 w-full items-center justify-center rounded-3xl bg-emerald-500 text-4xl font-black text-white shadow-xl transition-transform active:scale-95"
            >
              {myInput !== undefined ? "已斬出！⚡" : "斬！！！"}
            </button>
          </div>
        )}

        {state.phase === "action" && challenge?.type === "emoji_math" && (
          <div className="space-y-3 py-4">
            <p className="mb-2 text-sm text-white/70">🍎 + 🍌 = 5，🍎 = 2，🍌 = ？</p>
            <div className="grid grid-cols-3 gap-2">
              {["2", "3", "4"].map((ans) => (
                <Button
                  key={ans}
                  variant="ghost"
                  size="md"
                  aria-pressed={myInput === ans}
                  disabled={myInput !== undefined}
                  onClick={() => void handleMath(ans)}
                  className="py-6 text-2xl font-bold"
                >
                  {ans}
                </Button>
              ))}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="py-8">
            <p className="mb-2 text-5xl" aria-hidden="true">
              🏆
            </p>
            <p className="text-lg font-bold text-yellow-400">
              {state.roundWinnerId === player.id ? "🎉 你奪得了王位！" : "看大螢幕公布王者！"}
            </p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
