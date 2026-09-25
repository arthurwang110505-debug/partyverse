"use client";

import { useEffect } from "react";
import { useRoom } from "@/providers/RoomContext";
import { engineRoom } from "@/engine/participants";
import type { BrainGameState } from "@/engine/brainTeaser";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function HostBrainTeaser() {
  const { room } = useRoom();
  const state = room?.gameState as BrainGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  useEffect(() => {
    if (state?.phase === "result" && state.winnerId) sfx.playFanfare();
  }, [state?.phase, state?.winnerId]);

  if (!state?.riddle) return null;
  const ids = Object.keys(players);
  const answered = ids.filter((id) => state.answers[id] !== undefined).length;
  const total = Math.max(10, room?.settings?.timer ?? 20);

  return (
    <HostShell>
      {state.phase === "result" && state.winnerId && <Confetti />}
      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-2 text-sm font-semibold tracking-wider text-yellow-300">
          腦筋急轉彎 💡 · 第 {state.currentRound} / {state.totalRounds} 題
        </p>
        {state.phase !== "result" ? (
          <h1 className="mb-8 px-4 text-3xl font-black leading-tight text-white md:text-5xl">{state.riddle.question}</h1>
        ) : (
          <h1 className="mb-8 text-4xl font-black text-yellow-300 md:text-6xl">
            👑 {state.winnerId ? players[state.winnerId]?.nickname : "大家"} 是急轉彎大師！
          </h1>
        )}

        {state.phase !== "result" && (
          <div className="mx-auto mb-8 grid max-w-3xl grid-cols-2 gap-4">
            {state.options.map((opt, i) => {
              const right = state.phase === "reveal" && opt === state.riddle.answer;
              const pickers = ids.filter((id) => state.answers[id] === opt);
              return (
                <div
                  key={opt}
                  className={cn(
                    "rounded-2xl border-2 p-5 text-2xl font-black transition-all md:text-3xl",
                    right
                      ? "scale-105 border-emerald-300 bg-emerald-500/25 text-emerald-100"
                      : state.phase === "reveal"
                        ? "border-white/5 bg-white/5 text-white/30"
                        : "border-white/15 bg-white/5 text-white",
                  )}
                >
                  <span className="mr-2 text-yellow-300">{"ABCD"[i]}.</span>
                  {opt}
                  {state.phase === "reveal" && pickers.length > 0 && (
                    <p className="mt-2 text-base font-semibold">
                      {pickers.map((id) => players[id]?.avatar).join(" ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {state.phase === "question" && (
          <div className="mx-auto mb-6 max-w-md">
            <RoundTimer timeLeft={state.timeLeft} total={total} endLabel="揭曉答案" />
            <p className="mt-3 text-white/60">
              已作答 {answered} / {ids.length}
            </p>
          </div>
        )}
        {state.phase === "reveal" && (
          <p className="mb-6 text-xl font-bold text-emerald-200">💡 {state.riddle.explain}</p>
        )}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.map((id) => (
            <PlayerChip
              key={id}
              avatar={players[id].avatar}
              nickname={players[id].nickname}
              score={state.currentScores[id] ?? 0}
              highlight={state.phase === "reveal" && (state.roundPoints[id] ?? 0) > 0}
              status={
                state.phase === "question"
                  ? state.answers[id] !== undefined
                    ? "已作答 ✅"
                    : "思考中…"
                  : state.phase === "reveal"
                    ? (state.roundPoints[id] ?? 0) > 0
                      ? `+${state.roundPoints[id]}`
                      : "沒答對"
                    : undefined
              }
            />
          ))}
        </ul>
        <HostGameControls />
      </div>
    </HostShell>
  );
}
