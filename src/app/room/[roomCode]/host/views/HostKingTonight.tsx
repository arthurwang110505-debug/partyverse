"use client";

import { useRoom } from "@/providers/RoomContext";
import type { KingGameState } from "@/engine/kingTonight";
import { Button } from "@/components/ui/Button";

export default function HostKingTonight() {
  const { room, endRound, endGame } = useRoom();
  const state = room?.gameState as KingGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const king = state.currentKingId ? players[state.currentKingId] : null;

  return (
    <div className="mx-auto max-w-4xl text-center">
      <header className="mb-6">
        <p className="text-sm text-yellow-400 font-semibold mb-2">
          第 {state.currentRound} / {state.totalRounds} 場挑戰 · 今晚誰是王 👑
        </p>
        <h1 className="text-3xl md:text-5xl font-black text-white px-4">
          {state.challenge?.title}
        </h1>
        <p className="text-white/60 mt-2 max-w-lg mx-auto">{state.challenge?.instruction}</p>
      </header>

      {king && (
        <div className="glass inline-flex items-center gap-3 px-6 py-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 mb-6">
          <span className="text-2xl">👑</span>
          <span className="text-sm font-bold text-yellow-300">現任王者：{king.nickname}</span>
        </div>
      )}

      {state.phase === "briefing" && (
        <div className="my-10">
          <p className="text-7xl font-black tabular-nums text-yellow-400 mb-4 animate-bounce">
            {state.timeLeft}
          </p>
          <p className="text-xl text-white font-bold">全員準備！即將開戰！</p>
        </div>
      )}

      {state.phase === "action" && (
        <div className="my-8">
          <p className="text-6xl font-black tabular-nums text-red-500 mb-4 animate-pulse">
            {state.timeLeft}
          </p>
          <p className="text-xl text-white font-black animate-pulse">激戰進行中！在手機上拚搏！</p>
        </div>
      )}

      {state.phase === "reveal" && (
        <div className="my-8 p-6 rounded-3xl bg-yellow-400/10 border border-yellow-400/40 inline-block">
          <p className="text-6xl mb-2">👑</p>
          <span className="text-xs uppercase tracking-wider text-yellow-300 font-bold block mb-1">勝者加冕</span>
          <h2 className="text-3xl font-black text-white mb-2">
            {state.roundWinnerId ? players[state.roundWinnerId]?.nickname : "平手"} 登基為王！
          </h2>
          <p className="text-sm text-white/60">奪下 +25 分王者積分！</p>
        </div>
      )}

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-8">
        {Object.entries(players).map(([id, p]) => (
          <li key={id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <p className="text-2xl mb-1">{p.avatar}</p>
            <p className="truncate text-sm font-medium">{p.nickname}</p>
            <p className="text-xs text-white/40">{state.currentScores?.[id] ?? 0} 分</p>
          </li>
        ))}
      </ul>

      <div className="flex justify-center gap-3 mt-8">
        <Button variant="ghost" size="md" onClick={() => void endRound()}>重開</Button>
        <Button variant="danger" size="md" onClick={() => void endGame()}>結算</Button>
      </div>
    </div>
  );
}
