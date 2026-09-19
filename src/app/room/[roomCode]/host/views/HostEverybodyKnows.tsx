"use client";

import { useRoom } from "@/providers/RoomContext";
import type { EverybodyGameState } from "@/engine/everybodyKnows";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function HostEverybodyKnows() {
  const { room, endRound, endGame } = useRoom();
  const state = room?.gameState as EverybodyGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const totalVotes = Object.keys(state.votes ?? {}).length;
  const totalPlayers = Object.keys(players).length;

  return (
    <div className="mx-auto max-w-4xl text-center">
      <header className="mb-6">
        <p className="mb-2 text-sm text-cyan-400 font-semibold uppercase tracking-wider">
          第 {state.currentRound} / {state.totalRounds} 回合
        </p>
        <h1 className="text-3xl md:text-5xl font-black text-white px-4 leading-tight">
          {state.question?.question}
        </h1>
      </header>

      {state.phase === "voting" && (
        <div className="my-12">
          <p className="text-6xl md:text-8xl font-black tabular-nums text-cyan-400 mb-4 animate-pulse">
            {state.timeLeft}
          </p>
          <p className="text-lg text-white/60">
            請在手機上投票！已投票人數：<span className="text-cyan-400 font-bold">{totalVotes} / {totalPlayers}</span>
          </p>
        </div>
      )}

      {state.phase === "reveal" && (
        <div className="my-10 space-y-6">
          <p className="text-2xl font-bold text-yellow-400 animate-bounce">
            🎉 票選最高主角出爐！
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {state.mostVotedPlayerIds.map((id) => {
              const p = players[id];
              const count = state.voteCounts[id] ?? 0;
              return (
                <div key={id} className="glass border-yellow-400/50 bg-yellow-400/10 rounded-2xl p-6 min-w-[200px]">
                  <p className="text-6xl mb-2">{p?.avatar ?? "👤"}</p>
                  <p className="text-2xl font-black text-white">{p?.nickname}</p>
                  <p className="text-lg font-bold text-yellow-400 mt-2">{count} 票</p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-white/50">即將進入下一題倒數：{state.timeLeft} 秒</p>
        </div>
      )}

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-8">
        {Object.entries(players).map(([id, p]) => (
          <li
            key={id}
            className={cn(
              "rounded-xl border p-3 text-center transition-all",
              state.phase === "voting" && state.votes[id]
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-white/10 bg-white/5"
            )}
          >
            <p className="text-2xl mb-1">{p.avatar}</p>
            <p className="truncate text-sm font-medium">{p.nickname}</p>
            <p className="text-xs text-white/40">{state.currentScores?.[id] ?? 0} 分</p>
            {state.phase === "voting" && (
              <span className="text-[10px] mt-1 inline-block text-white/50">
                {state.votes[id] ? "已投票 ✅" : "思考中…"}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex justify-center gap-3 mt-8">
        <Button variant="ghost" size="md" onClick={() => void endRound()}>
          重啟本局
        </Button>
        <Button variant="danger" size="md" onClick={() => void endGame()}>
          結束結算
        </Button>
      </div>
    </div>
  );
}
