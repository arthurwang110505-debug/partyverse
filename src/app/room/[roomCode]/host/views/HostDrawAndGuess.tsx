"use client";

import { useRoom } from "@/providers/RoomContext";
import type { DrawGameState } from "@/engine/drawAndGuess";
import { Button } from "@/components/ui/Button";

export default function HostDrawAndGuess() {
  const { room, endRound, endGame } = useRoom();
  const state = room?.gameState as DrawGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const drawer = players[state.drawerPlayerId];

  return (
    <div className="mx-auto max-w-4xl text-center">
      <header className="mb-4">
        <p className="text-sm text-pink-400 font-semibold mb-1">
          你畫我猜 🎨 · 第 {state.currentRound} / {state.totalRounds} 回合
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          畫家是：{drawer?.nickname ?? "等待中"}（題目類別：{state.prompt?.category}）
        </h1>
      </header>

      {/* Synchronized Canvas Display */}
      <div className="relative mx-auto my-4 w-full max-w-lg aspect-square bg-slate-900 border-2 border-white/20 rounded-3xl overflow-hidden shadow-2xl">
        <svg className="w-full h-full" viewBox="0 0 400 400">
          {state.strokes.map((s, idx) => {
            const pts = s.points;
            if (pts.length < 2) return null;
            let d = `M ${pts[0]} ${pts[1]}`;
            for (let i = 2; i < pts.length; i += 2) {
              d += ` L ${pts[i]} ${pts[i + 1]}`;
            }
            return <path key={idx} d={d} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
          })}
        </svg>

        {state.phase === "drawing" && (
          <div className="absolute top-4 right-4 bg-black/60 px-4 py-2 rounded-full border border-white/10">
            <span className="text-2xl font-black tabular-nums text-pink-400">{state.timeLeft}</span>
          </div>
        )}
      </div>

      {state.phase === "reveal" && (
        <div className="my-6 p-6 rounded-3xl bg-pink-500/10 border border-pink-500/40 inline-block">
          <p className="text-4xl mb-1">🎨</p>
          <span className="text-xs uppercase tracking-wider text-pink-300 font-bold block">正確答案是</span>
          <h2 className="text-3xl font-black text-white">{state.prompt?.word}</h2>
        </div>
      )}

      {/* Guessers status */}
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
        {Object.entries(players).map(([id, p]) => {
          const isDrawer = id === state.drawerPlayerId;
          const hasGuessed = state.correctPlayerIds?.includes(id);
          return (
            <li
              key={id}
              className={`rounded-xl border p-3 text-center ${
                hasGuessed ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-white/5"
              }`}
            >
              <p className="text-2xl mb-1">{p.avatar}</p>
              <p className="truncate text-sm font-medium">{p.nickname}</p>
              <p className="text-xs text-white/40">{state.currentScores?.[id] ?? 0} 分</p>
              <span className="text-[10px] block mt-1 font-bold">
                {isDrawer ? "🎨 畫家中" : hasGuessed ? "✅ 答對了！" : "猜題中…"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-center gap-3 mt-4">
        <Button variant="ghost" size="md" onClick={() => void endRound()}>重開</Button>
        <Button variant="danger" size="md" onClick={() => void endGame()}>結算</Button>
      </div>
    </div>
  );
}
