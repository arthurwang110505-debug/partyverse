"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { DrawGameState } from "@/engine/drawAndGuess";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";

export default function HostDrawAndGuess() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as DrawGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const drawer = players[state.drawerPlayerId];
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-4">
          <p className="mb-1 text-sm font-semibold text-pink-400">
            你畫我猜 🎨 · 第 {state.currentRound} / {state.totalRounds} 回合
          </p>
          <h1 className="text-2xl font-black text-white md:text-3xl">
            畫家是：{drawer?.nickname ?? "等待中"}（題目類別：{state.prompt?.category}）
          </h1>
        </header>

        {/* Synchronized Canvas Display */}
        <div className="relative mx-auto my-4 aspect-square w-full max-w-lg overflow-hidden rounded-3xl border-2 border-white/20 bg-slate-900 shadow-2xl">
          <svg className="h-full w-full" viewBox="0 0 400 400" role="img" aria-label="共享畫布">
            {state.strokes.map((s, idx) => {
              const pts = s.points;
              if (pts.length < 2) return null;
              let d = `M ${pts[0]} ${pts[1]}`;
              for (let i = 2; i < pts.length; i += 2) {
                d += ` L ${pts[i]} ${pts[i + 1]}`;
              }
              return (
                <path
                  key={idx}
                  d={d}
                  stroke={s.color}
                  strokeWidth={s.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>

          {state.phase === "drawing" && (
            <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/60 px-4 py-2">
              <span className="text-2xl font-black tabular-nums text-pink-400" aria-hidden="true">
                {state.timeLeft}
              </span>
            </div>
          )}
        </div>

        {state.phase === "reveal" && (
          <div className="my-6 inline-block rounded-3xl border border-pink-500/40 bg-pink-500/10 p-6">
            <p className="mb-1 text-4xl" aria-hidden="true">
              🎨
            </p>
            <span className="block text-xs font-bold uppercase tracking-wider text-pink-300">正確答案是</span>
            <h2 className="text-3xl font-black text-white">{state.prompt?.word}</h2>
          </div>
        )}

        {/* Guessers status */}
        <ul className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => {
            const isDrawer = id === state.drawerPlayerId;
            const hasGuessed = state.correctPlayerIds?.includes(id);
            return (
              <PlayerChip
                key={id}
                avatar={p.avatar}
                nickname={p.nickname}
                score={state.currentScores?.[id] ?? 0}
                highlight={Boolean(hasGuessed)}
                status={isDrawer ? "🎨 畫家中" : hasGuessed ? "✅ 答對了！" : "猜題中…"}
              />
            );
          })}
        </ul>

        <div className="mt-4 flex justify-center gap-3">
          <Button variant="ghost" size="md" onClick={() => endRound().catch(fail)}>
            重開
          </Button>
          <Button variant="danger" size="md" onClick={() => endGame().catch(fail)}>
            結算
          </Button>
        </div>
      </div>
    </HostShell>
  );
}
