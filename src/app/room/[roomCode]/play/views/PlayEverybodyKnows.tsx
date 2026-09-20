"use client";

import { engineRoom } from "@/engine/participants";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { EverybodyGameState } from "@/engine/everybodyKnows";
import { PlayShell } from "@/components/game/PlayShell";
import { Users2, Check } from "lucide-react";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function PlayEverybodyKnows() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as EverybodyGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  if (!state || !player) return null;

  const myVote = state.votes?.[player.id];
  const otherPlayers = Object.entries(players);

  const handleVote = async (targetId: string) => {
    vibrate(15);
    try {
      await submitAction({ type: "vote", targetPlayerId: targetId });
    } catch {
      toast("投票失敗，請再試一次");
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="text-center pt-2">
        <header className="mb-5">
          <span className="mb-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <Users2 className="h-3.5 w-3.5" /> 人人都知道
          </span>
          <div className="glass rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 shadow-lg mt-1">
            <span className="block text-xs text-cyan-300 font-semibold mb-1">本輪靈魂拷問：</span>
            <h2 className="text-xl font-black leading-snug text-white">{state.question?.question}</h2>
          </div>
        </header>

        {state.phase === "voting" && (
          <div>
            <p className="mb-4 text-xs font-semibold text-white/70">
              {myVote ? "✓ 你已完成指認，等待其他人完成投票！" : "指認你心中最符合的人選（點擊投給他）："}
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
                      "flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-4 text-center transition-all shadow-md active:scale-95",
                      selected
                        ? "border-cyan-400 bg-cyan-500/25 text-cyan-200 ring-2 ring-cyan-400 scale-[1.02]"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20",
                    )}
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="max-w-[120px] truncate text-sm font-bold">{p.nickname}</span>
                    {selected && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-cyan-300">
                        <Check className="h-3 w-3" /> 已指認
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="py-8 glass rounded-3xl border border-white/10 p-6 shadow-xl animate-scale-in">
            <p className="mb-2 text-5xl" aria-hidden="true">
              📊
            </p>
            <h3 className="mb-2 text-xl font-black text-cyan-300">現場票數揭曉！</h3>
            <p className="text-sm text-white/70">
              {state.mostVotedPlayerIds.includes(player.id)
                ? "👑 高票當選！大家最心知肚明的人就是你！"
                : "快看電視大螢幕誰是全場最高票！"}
            </p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
