"use client";

import { useRoom } from "@/providers/RoomContext";
import type { UndercoverGameState } from "@/engine/whoIsUndercover";
import { Button } from "@/components/ui/Button";

export default function HostUndercover() {
  const { room, endRound, endGame } = useRoom();
  const state = room?.gameState as UndercoverGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  return (
    <div className="mx-auto max-w-4xl text-center">
      <header className="mb-6">
        <p className="text-sm text-purple-400 font-semibold mb-2">
          第 {state.currentRound} 回合 · 臥底是誰？
        </p>
        <h1 className="text-3xl md:text-5xl font-black text-white px-4">
          {state.phase === "viewing_words" && "請全體玩家查看各自手機上的秘密詞！"}
          {state.phase === "discussion" && "🗣️ 自由發言與辯論時間"}
          {state.phase === "voting" && "🗳️ 投票處決時間！誰是臥底？"}
          {state.phase === "eliminated" && "⚖️ 處決揭曉！"}
          {state.phase === "result" && "🏆 勝負揭曉！"}
        </h1>
      </header>

      {(state.phase === "viewing_words" || state.phase === "discussion" || state.phase === "voting") && (
        <div className="my-10">
          <p className="text-7xl font-black tabular-nums text-purple-400 mb-4 animate-pulse">
            {state.timeLeft}
          </p>
          <p className="text-white/60">
            {state.phase === "discussion" ? "每人輪流用一句話描述你的詞，但別說破！" : "注意彼此的微表情與用詞"}
          </p>
        </div>
      )}

      {state.phase === "eliminated" && state.lastVotedOutId && (
        <div className="my-10 p-6 rounded-3xl bg-red-500/10 border border-red-500/30 inline-block">
          <p className="text-6xl mb-2">💀</p>
          <h2 className="text-2xl font-black text-red-400 mb-1">
            {players[state.lastVotedOutId]?.nickname} 被處決出局！
          </h2>
          <p className="text-sm text-white/60">遊戲繼續進行…</p>
        </div>
      )}

      {state.phase === "result" && (
        <div className="my-10 p-8 rounded-3xl bg-purple-500/10 border border-purple-500/40 inline-block">
          <p className="text-6xl mb-2">{state.winnerTeam === "undercover" ? "🕵️" : "🎉"}</p>
          <h2 className="text-3xl font-black text-yellow-400 mb-3">
            {state.winnerTeam === "undercover" ? "臥底大獲全勝！" : "平民破案大獲全勝！"}
          </h2>
          <div className="text-sm text-white/80 space-y-1">
            <p>平民秘密詞：<span className="font-bold text-white">{state.civilianWord}</span></p>
            <p>臥底秘密詞：<span className="font-bold text-pink-400">{state.undercoverWord}</span>（臥底是：{players[state.undercoverPlayerId]?.nickname}）</p>
          </div>
        </div>
      )}

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-8">
        {Object.entries(players).map(([id, p]) => {
          const isOut = state.eliminatedPlayerIds.includes(id);
          return (
            <li
              key={id}
              className={`rounded-xl border p-3 text-center transition-all ${
                isOut ? "border-red-500/20 bg-red-500/5 opacity-40" : "border-white/10 bg-white/5"
              }`}
            >
              <p className="text-2xl mb-1">{isOut ? "💀" : p.avatar}</p>
              <p className="truncate text-sm font-medium">{p.nickname}</p>
              <p className="text-xs text-white/40">{isOut ? "已淘汰" : "存活中"}</p>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-center gap-3 mt-8">
        <Button variant="ghost" size="md" onClick={() => void endRound()}>重開</Button>
        <Button variant="danger" size="md" onClick={() => void endGame()}>結算</Button>
      </div>
    </div>
  );
}
