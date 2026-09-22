"use client";

import { engineRoom } from "@/engine/participants";

import { useState } from "react";
import { Eye, Lock, ShieldAlert } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { UndercoverGameState } from "@/engine/whoIsUndercover";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function PlayUndercover() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as UndercoverGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const [revealed, setRevealed] = useState(false);

  if (!state || !player) return null;

  const myWord = state.playerWords?.[player.id];
  const isEliminated = state.eliminatedPlayerIds?.includes(player.id);
  const myVote = state.votes?.[player.id];

  const handleVote = async (targetId: string) => {
    vibrate(15);
    try {
      await submitAction({ type: "vote", targetPlayerId: targetId });
    } catch {
      toast("投票失敗，請再試一次");
    }
  };

  const handleRevealStart = () => {
    vibrate(20);
    setRevealed(true);
  };

  const handleRevealEnd = () => {
    setRevealed(false);
  };

  if (isEliminated) {
    return (
      <PlayShell round={`第 ${state.currentRound} 回合`}>
        <div className="py-12 text-center">
          <p className="mb-2 text-6xl" aria-hidden="true">
            💀
          </p>
          <h2 className="text-xl font-bold text-red-400">你已被投票處決出局</h2>
          <p className="mt-1 text-sm text-white/50">請保持緘默，觀看大螢幕精彩辯論與投票！</p>
        </div>
      </PlayShell>
    );
  }

  return (
    <PlayShell round={`第 ${state.currentRound} 回合`}>
      <div className="text-center pt-2">
        <header className="mb-4">
          <span className="mb-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-purple-400">
            <ShieldAlert className="h-3.5 w-3.5" /> 誰是臥底？
          </span>
        </header>

        {/* Tactile Privacy Reveal Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={revealed}
          onPointerDown={handleRevealStart}
          onPointerUp={handleRevealEnd}
          onPointerLeave={handleRevealEnd}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "relative mb-6 select-none overflow-hidden rounded-3xl border p-6 text-center transition-all duration-200 cursor-pointer shadow-xl",
            revealed
              ? "border-purple-400/80 bg-purple-600/30 ring-4 ring-purple-500/20 scale-[1.02]"
              : "border-purple-500/30 bg-purple-950/40 hover:bg-purple-900/40 active:scale-[0.98]",
          )}
        >
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-300">
            {revealed ? (
              <>
                <Eye className="h-4 w-4 text-purple-300 animate-pulse" aria-hidden="true" />
                正在顯示詞彙（放開手指隱藏）
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-purple-400" aria-hidden="true" />
                防偷窺機制 · 按住卡片顯示詞彙
              </>
            )}
          </div>

          <div className="min-h-[64px] flex items-center justify-center">
            {revealed ? (
              <p className="text-3xl font-black tracking-widest text-white drop-shadow-md animate-scale-in">
                {myWord ?? "…"}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 text-white/40">
                <p className="text-2xl font-bold tracking-widest filter blur-sm select-none">••••••••</p>
                <p className="text-[11px] text-white/50">按住不放以偷看，防止身旁好友窺屏</p>
              </div>
            )}
          </div>
        </div>

        {state.phase === "viewing_words" && (
          <div className="glass rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-medium text-white/80">請記好你的詞彙！</p>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">
              臥底的詞彙與平民相似但不同。請思考稍後如何隱晦描述，既能證明清白又不會被臥底識破！
            </p>
          </div>
        )}

        {state.phase === "discussion" && (
          <div className="glass rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold text-purple-300">現場發言與討論階段</p>
            <p className="mt-1 text-xs text-white/60 leading-relaxed">
              依照大螢幕順序，每個人輪流用一句話描述你的詞彙。仔細聽聽誰的發言有破綻！
            </p>
          </div>
        )}

        {state.phase === "eliminated" && state.lastVotedOutId && (
          <div className="glass animate-scale-in rounded-2xl border border-red-500/30 bg-red-950/40 p-4">
            <p className="text-sm font-semibold text-red-300">
              {players[state.lastVotedOutId]?.nickname} 被處決出局
            </p>
            <p className="mt-1 text-xs text-white/60 leading-relaxed">觀戰大螢幕，看看誰是臥底…</p>
          </div>
        )}

        {state.phase === "eliminated" && !state.lastVotedOutId && (
          <div className="glass animate-scale-in rounded-2xl border border-amber-500/30 bg-amber-950/40 p-4">
            <p className="text-sm font-semibold text-amber-300">⚖️ 平票！這回合沒有人被處決</p>
            <p className="mt-1 text-xs text-white/60 leading-relaxed">臥底還在你們中間，準備繼續投票…</p>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="py-2">
            <p className="mb-3 text-xs font-semibold text-white/80">
              {myVote ? "✓ 投票已送出，等待其他玩家！" : "選出你懷疑是臥底的玩家："}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(players)
                .filter(([id]) => id !== player.id && !state.eliminatedPlayerIds.includes(id))
                .map(([id, p]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={myVote === id}
                    disabled={Boolean(myVote)}
                    onClick={() => void handleVote(id)}
                    className={cn(
                      "rounded-2xl border p-3.5 text-center transition-all active:scale-95 shadow-md",
                      myVote === id
                        ? "border-purple-400 bg-purple-500/25 text-purple-200 ring-2 ring-purple-400"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10",
                    )}
                  >
                    <span className="mb-1 block text-3xl" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="block truncate text-sm font-bold">{p.nickname}</span>
                    {myVote === id && (
                      <span className="mt-1 inline-block text-[10px] font-semibold text-purple-300">已投此票</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
