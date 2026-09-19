"use client";

import { useRoom } from "@/providers/RoomContext";
import type { MysteryGameState } from "@/engine/mysteryRoom";
import { Button } from "@/components/ui/Button";

export default function HostMysteryRoom() {
  const { room, endRound, endGame } = useRoom();
  const state = room?.gameState as MysteryGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  return (
    <div className="mx-auto max-w-4xl text-center">
      <header className="mb-6">
        <p className="text-sm text-indigo-400 font-semibold mb-1">
          密室推理 🔍 · 合作解謎逃脫
        </p>
        <h1 className="text-3xl md:text-5xl font-black text-white px-4">
          {state.caseTitle}
        </h1>
        <p className="text-white/60 mt-2 max-w-xl mx-auto text-sm">{state.caseBackground}</p>
      </header>

      {state.phase === "investigation" && (
        <div className="my-8">
          <p className="text-7xl font-black tabular-nums text-indigo-400 mb-4 animate-pulse">
            {state.timeLeft}
          </p>
          <div className="glass p-6 rounded-3xl border border-indigo-500/30 bg-indigo-500/10 inline-block mb-6">
            <span className="text-xs uppercase tracking-wider text-indigo-300 font-bold block mb-1">四位數逃生密碼鎖</span>
            <p className="text-4xl font-mono font-black text-white tracking-[0.4em]">
              {state.submittedCode ? state.submittedCode.padEnd(4, "•") : "••••"}
            </p>
          </div>
          <p className="text-sm text-white/50">四位數線索分散在每位玩家的手機上，請口頭交流拼湊真相！</p>
        </div>
      )}

      {state.phase === "result" && (
        <div className="my-8 p-6 rounded-3xl bg-indigo-500/10 border border-indigo-500/40 inline-block">
          <p className="text-6xl mb-2">{state.isUnlocked ? "🔓" : "🔒"}</p>
          <h2 className="text-3xl font-black text-white mb-2">
            {state.isUnlocked ? "🎉 成功解鎖逃脫！" : "⏰ 時間到，逃脫失敗！"}
          </h2>
          <p className="text-sm text-white/60">
            {state.isUnlocked ? `由 ${players[state.unlockedByPlayerId ?? ""]?.nickname} 輸入正確密碼！全體通關！` : "密碼是 7429"}
          </p>
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
