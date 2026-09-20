"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { EverybodyGameState } from "@/engine/everybodyKnows";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";

export default function HostEverybodyKnows() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as EverybodyGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const totalVotes = Object.keys(state.votes ?? {}).length;
  const totalPlayers = Object.keys(players).length;
  const totalTime = room?.settings?.timer ?? 15;

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-cyan-400">
            第 {state.currentRound} / {state.totalRounds} 回合
          </p>
          <h1 className="px-4 text-3xl font-black leading-tight text-white md:text-5xl">
            {state.question?.question}
          </h1>
        </header>

        {state.phase === "voting" && (
          <div className="my-12">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={totalTime} endLabel="投票截止" />
            </div>
            <p className="text-lg text-white/60">
              請在手機上投票！已投票人數：
              <span className="font-bold text-cyan-400">
                {totalVotes} / {totalPlayers}
              </span>
            </p>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="my-10 space-y-6">
            <p className="motion-safe:animate-bounce text-2xl font-bold text-yellow-400">🎉 票選最高主角出爐！</p>
            <div className="flex flex-wrap justify-center gap-4">
              {state.mostVotedPlayerIds.map((id) => {
                const p = players[id];
                const count = state.voteCounts[id] ?? 0;
                return (
                  <div key={id} className="glass min-w-[200px] rounded-2xl border-yellow-400/50 bg-yellow-400/10 p-6">
                    <p className="mb-2 text-6xl" aria-hidden="true">
                      {p?.avatar ?? "👤"}
                    </p>
                    <p className="text-2xl font-black text-white">{p?.nickname}</p>
                    <p className="mt-2 text-lg font-bold text-yellow-400">{count} 票</p>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-white/50">即將進入下一題倒數：{state.timeLeft} 秒</p>
          </div>
        )}

        <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => (
            <PlayerChip
              key={id}
              avatar={p.avatar}
              nickname={p.nickname}
              score={state.currentScores?.[id] ?? 0}
              status={state.phase === "voting" ? (state.votes[id] ? "已投票 ✅" : "思考中…") : undefined}
              highlight={state.phase === "voting" && Boolean(state.votes[id])}
            />
          ))}
        </ul>

        <div className="mt-8 flex justify-center gap-3">
          <Button variant="ghost" size="md" onClick={() => endRound().catch(fail)}>
            重啟本局
          </Button>
          <Button variant="danger" size="md" onClick={() => endGame().catch(fail)}>
            結束結算
          </Button>
        </div>
      </div>
    </HostShell>
  );
}
