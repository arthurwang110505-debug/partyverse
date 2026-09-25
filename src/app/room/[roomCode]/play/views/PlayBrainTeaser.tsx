"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { BrainGameState } from "@/engine/brainTeaser";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate, sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function PlayBrainTeaser() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const state = room?.gameState as BrainGameState | undefined;
  if (!state?.riddle || !player) return null;

  const mine = state.answers[player.id];
  const points = state.roundPoints[player.id] ?? 0;

  const choose = async (choice: string) => {
    if (mine !== undefined || pending) return;
    setPending(choice);
    vibrate(20);
    try {
      await submitAction({ type: "answer", choice });
      sfx.playPop();
    } catch {
      toast("送出失敗，請再試一次");
    } finally {
      setPending(null);
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 題`}>
      <div className="text-center">
        <p className="mb-1 mt-2 text-xs font-bold uppercase tracking-wider text-yellow-300">💡 腦筋急轉彎</p>
        {state.phase !== "result" && (
          <h1 className="mb-4 text-xl font-black leading-snug text-white">{state.riddle.question}</h1>
        )}

        {state.phase === "question" && (
          <>
            <div className="grid grid-cols-1 gap-3">
              {state.options.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  disabled={mine !== undefined || Boolean(pending)}
                  aria-pressed={mine === opt}
                  onClick={() => void choose(opt)}
                  className={cn(
                    "min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-lg font-bold transition-all active:scale-95",
                    mine === opt || pending === opt
                      ? "border-yellow-300 bg-yellow-400/25 text-yellow-100"
                      : mine !== undefined
                        ? "border-white/5 bg-white/5 text-white/30"
                        : "border-white/15 bg-white/5 text-white",
                  )}
                >
                  <span className="mr-2 text-yellow-300">{"ABCD"[i]}.</span>
                  {opt}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <RoundTimer timeLeft={state.timeLeft} total={Math.max(10, room?.settings?.timer ?? 20)} endLabel="揭曉" compact />
            </div>
            {mine !== undefined && <p className="mt-3 text-sm text-white/70">已送出！看大螢幕等揭曉 👀</p>}
          </>
        )}

        {state.phase === "reveal" && (
          <div className="py-6">
            <p className="mb-2 text-6xl" aria-hidden="true">
              {points > 0 ? "🎉" : mine === undefined ? "⌛" : "😵"}
            </p>
            <h2 className={cn("text-2xl font-black", points > 0 ? "text-emerald-300" : "text-red-300")}>
              {points > 0 ? `答對了！+${points}` : mine === undefined ? "來不及作答" : "被騙了！"}
            </h2>
            <p className="mt-3 text-lg text-white">
              答案：<span className="font-black text-yellow-300">{state.riddle.answer}</span>
            </p>
            <p className="mt-1 text-sm text-white/60">{state.riddle.explain}</p>
          </div>
        )}

        {state.phase === "result" && (
          <div className="py-10">
            <p className="mb-3 text-6xl" aria-hidden="true">
              {state.winnerIds.includes(player.id) ? "👑" : "💡"}
            </p>
            <h2 className="text-2xl font-black text-white">
              {state.winnerIds.includes(player.id) ? "你是急轉彎大師！" : "比賽結束！"}
            </h2>
            <p className="mt-2 text-sm text-white/60">總分 {state.currentScores[player.id] ?? 0}，排名看大螢幕。</p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
