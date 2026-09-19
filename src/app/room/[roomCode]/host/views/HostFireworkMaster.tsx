"use client";

import { useRoom } from "@/providers/RoomContext";
import type { FireworkGameState } from "@/engine/fireworkMaster";
import { Button } from "@/components/ui/Button";

export default function HostFireworkMaster() {
  const { room, endRound, endGame } = useRoom();
  const state = room?.gameState as FireworkGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  return (
    <div className="mx-auto max-w-4xl text-center">
      <header className="mb-6">
        <p className="text-sm text-cyan-400 font-semibold mb-2">
          煙火大師 🎆 · 創意競賽
        </p>
        <h1 className="text-3xl md:text-5xl font-black text-white px-4">
          {state.phase === "designing" && "玩家正在手機調配專屬煙火…"}
          {state.phase === "show" && "✨ 全體煙火聯合大匯演 ✨"}
          {state.phase === "voting" && "🗳️ 投票評選你最喜愛的煙火！"}
          {state.phase === "result" && "🏆 最佳煙火設計大師！"}
        </h1>
      </header>

      {state.phase === "designing" && (
        <div className="my-10">
          <p className="text-7xl font-black tabular-nums text-cyan-400 mb-4 animate-pulse">
            {state.timeLeft}
          </p>
          <p className="text-white/60">在手機上選擇顏色、火花形狀與特效</p>
        </div>
      )}

      {state.phase === "show" && (
        <div className="my-8 relative h-64 border border-white/10 rounded-3xl bg-black/60 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-around pointer-events-none">
            {Object.entries(state.designs).map(([id, d], i) => (
              <div
                key={id}
                className="animate-bounce"
                style={{ animationDuration: `${0.8 + (i % 3) * 0.4}s` }}
              >
                <div
                  className="w-16 h-16 rounded-full blur-sm"
                  style={{ backgroundColor: d.color, boxShadow: `0 0 40px ${d.color}` }}
                />
                <p className="text-xs text-white/80 mt-2 text-center font-bold">{players[id]?.nickname}</p>
              </div>
            ))}
          </div>
          <p className="text-2xl font-black text-yellow-300 z-10 animate-pulse">
            🎆 夜空綻放中！剩餘 {state.timeLeft} 秒 🎆
          </p>
        </div>
      )}

      {state.phase === "voting" && (
        <div className="my-8">
          <p className="text-5xl font-black tabular-nums text-pink-400 mb-2">
            {state.timeLeft}
          </p>
          <p className="text-lg text-white">請在手機投下你最欣賞的設計！</p>
        </div>
      )}

      {state.phase === "result" && (
        <div className="my-8 p-6 rounded-3xl bg-cyan-500/10 border border-cyan-400/40 inline-block">
          <p className="text-6xl mb-2">🎆</p>
          <span className="text-xs uppercase tracking-wider text-cyan-300 font-bold block mb-1">人氣總冠軍</span>
          <h2 className="text-3xl font-black text-white mb-2">
            {state.winnerId ? players[state.winnerId]?.nickname : "全體大師"} 贏得最佳煙火賞！
          </h2>
          <p className="text-sm text-white/60">獲得 {state.voteCounts[state.winnerId ?? ""] ?? 0} 票肯定！</p>
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
