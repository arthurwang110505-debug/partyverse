"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { EverybodyGameState } from "@/engine/everybodyKnows";
import { PlayShell } from "@/components/game/PlayShell";
import { cn } from "@/lib/utils";

export default function PlayEverybodyKnows() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as EverybodyGameState | undefined;
  const players = room?.players ?? {};

  if (!state || !player) return null;

  const myVote = state.votes?.[player.id];
  const otherPlayers = Object.entries(players);

  const handleVote = async (targetId: string) => {
    try {
      await submitAction({ type: "vote", targetPlayerId: targetId });
    } catch {
      toast("投票失敗，請再試一次");
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="text-center">
        <header className="mb-6 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-cyan-400">大家心知肚明</span>
          <h2 className="text-xl font-bold leading-snug text-white">{state.question?.question}</h2>
        </header>

        {state.phase === "voting" && (
          <div>
            <p className="mb-4 text-xs text-white/50">
              {myVote ? "你已完成投票，等待其他人！" : "選出你心中最符合的人選："}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {otherPlayers.map(([id, p]) => {
                const selected = myVote === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    disabled={Boolean(myVote)}
                    onClick={() => void handleVote(id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-2xl border p-4 text-center transition-all",
                      selected
                        ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 ring-2 ring-cyan-400"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-95",
                    )}
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="max-w-[120px] truncate text-sm font-bold">{p.nickname}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="py-8">
            <p className="mb-2 text-4xl" aria-hidden="true">
              📊
            </p>
            <h3 className="mb-2 text-lg font-bold text-yellow-400">揭曉中</h3>
            <p className="text-sm text-white/60">
              {state.mostVotedPlayerIds.includes(player.id) ? "你被大家投中了！" : "看大螢幕揭曉投票結果！"}
            </p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
