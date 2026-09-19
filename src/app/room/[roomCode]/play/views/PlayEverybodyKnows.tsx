"use client";

import { useRoom } from "@/providers/RoomContext";
import type { EverybodyGameState } from "@/engine/everybodyKnows";
import { cn } from "@/lib/utils";

export default function PlayEverybodyKnows() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as EverybodyGameState | undefined;
  const players = room?.players ?? {};

  if (!state || !player) return null;

  const myVote = state.votes?.[player.id];
  const otherPlayers = Object.entries(players);

  const handleVote = async (targetId: string) => {
    try {
      await submitAction({ type: "vote", targetPlayerId: targetId });
    } catch {
      // Ignore
    }
  };

  return (
    <div className="mx-auto max-w-md text-center p-4">
      <header className="mb-6">
        <span className="text-xs uppercase tracking-wider text-cyan-400 font-bold block mb-1">
          大家心知肚明 · 第 {state.currentRound} 回合
        </span>
        <h2 className="text-xl font-bold text-white leading-snug">
          {state.question?.question}
        </h2>
      </header>

      {state.phase === "voting" && (
        <div>
          <p className="text-xs text-white/50 mb-4">
            {myVote ? "你已完成投票，等待其他人！" : "選出你心中最符合的人選："}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {otherPlayers.map(([id, p]) => {
              const selected = myVote === id;
              return (
                <button
                  key={id}
                  disabled={Boolean(myVote)}
                  onClick={() => void handleVote(id)}
                  className={cn(
                    "p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1",
                    selected
                      ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 ring-2 ring-cyan-400"
                      : "border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-95"
                  )}
                >
                  <span className="text-3xl">{p.avatar}</span>
                  <span className="font-bold text-sm truncate max-w-[120px]">{p.nickname}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state.phase === "reveal" && (
        <div className="py-8">
          <p className="text-4xl mb-2">📊</p>
          <h3 className="text-lg font-bold text-yellow-400 mb-2">揭曉中</h3>
          <p className="text-sm text-white/60">
            {state.mostVotedPlayerIds.includes(player.id) ? "你被大家投中了！" : "看大螢幕揭曉投票結果！"}
          </p>
        </div>
      )}
    </div>
  );
}
