"use client";

import { useRoom } from "@/providers/RoomContext";
import { drawHint, type DrawGameState } from "@/engine/drawAndGuess";
import { HostShell } from "@/components/game/HostShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { DrawingCanvas } from "@/components/game/DrawingCanvas";
import { PlayerChip } from "@/components/game/PlayerChip";
import { HostGameControls } from "@/components/game/HostGameControls";
import { participantIds } from "@/engine/participants";

export default function HostDrawAndGuess() {
  const { room } = useRoom();
  const state = room?.gameState as DrawGameState | undefined;
  if (!state || !room) return null;
  const ids = participantIds(room);
  const drawer = room.players[state.drawerPlayerId];
  return (
    <HostShell>
      <div className="mx-auto max-w-5xl text-center">
        <header className="mb-5">
          <p className="text-sm font-bold text-pink-300">
            第 {state.currentRound} / {state.totalRounds} 位畫家 · 每人輪流作畫
          </p>
          <h1 className="mt-2 text-2xl font-black md:text-4xl">
            {drawer?.nickname ?? "畫家"} {state.phase === "briefing" ? "準備作畫" : "的畫作"}
          </h1>
          {state.phase !== "reveal" && (
            <p className="mt-2 text-white/70">
              {state.prompt.category} · {drawHint(state, room.settings.difficulty)}
            </p>
          )}
        </header>
        <div className="mx-auto mb-4 max-w-lg">
          <RoundTimer
            compact
            timeLeft={state.timeLeft}
            total={state.phase === "drawing" ? state.drawDuration : state.phase === "briefing" ? 3 : 5}
            endLabel="本階段結束"
          />
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-lg overflow-hidden rounded-3xl border-2 border-white/20 bg-slate-950">
          <DrawingCanvas className="h-full w-full" strokes={state.strokes} />
          {state.phase === "briefing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/95 p-5">
              <span className="text-6xl" aria-hidden="true">
                🎨
              </span>
              <p className="text-xl font-bold">畫家請看手機上的秘密題目</p>
              <p className="text-white/60">其他人看畫猜題，越快猜中分數越高！</p>
            </div>
          )}
          {state.phase === "reveal" && (
            <div
              className="absolute inset-x-3 bottom-3 rounded-2xl border border-pink-400/40 bg-slate-950/95 p-4"
              role="status"
            >
              <p className="text-sm text-pink-200">
                {state.roundReason === "disconnected" ? "玩家離線 · 答案揭曉" : "答案揭曉"}
              </p>
              <h2 className="mt-1 text-3xl font-black">{state.prompt.word}</h2>
            </div>
          )}
        </div>
        {state.phase === "drawing" && (
          <div className="my-4 flex flex-wrap justify-center gap-2" aria-label="即時猜題動態">
            {Object.entries(state.guesses).map(([id, guess]) => (
              <p key={id} className="rounded-full bg-white/10 px-3 py-2 text-sm">
                <span className="text-white/60">{room.players[id]?.nickname}：</span>
                {state.correctPlayerIds.includes(id) ? (
                  <span className="font-bold text-emerald-300">答對了！ 🎉</span>
                ) : (
                  guess
                )}
              </p>
            ))}
          </div>
        )}
        <ul className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.map((id) => {
            const p = room.players[id];
            const solved = state.correctPlayerIds.includes(id);
            return (
              <PlayerChip
                key={id}
                avatar={p.avatar}
                nickname={p.nickname}
                score={state.currentScores[id] ?? 0}
                highlight={solved}
                status={
                  !p.isConnected
                    ? "離線"
                    : state.phase === "reveal"
                      ? `本回合 +${state.roundScores[id] ?? 0}`
                      : id === state.drawerPlayerId
                        ? "🎨 畫家"
                        : solved
                          ? "✓ 答對了"
                          : "猜題中"
                }
              />
            );
          })}
        </ul>
        <HostGameControls />
      </div>
    </HostShell>
  );
}
