"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { UndercoverGameState } from "@/engine/whoIsUndercover";
import { PlayShell } from "@/components/game/PlayShell";

export default function PlayUndercover() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as UndercoverGameState | undefined;
  const players = room?.players ?? {};

  if (!state || !player) return null;

  const myWord = state.playerWords?.[player.id];
  const isEliminated = state.eliminatedPlayerIds?.includes(player.id);
  const myVote = state.votes?.[player.id];

  const handleVote = async (targetId: string) => {
    try {
      await submitAction({ type: "vote", targetPlayerId: targetId });
    } catch {
      toast("投票失敗，請再試一次");
    }
  };

  if (isEliminated) {
    return (
      <PlayShell round={`第 ${state.currentRound} 回合`}>
        <div className="py-12 text-center">
          <p className="mb-2 text-6xl" aria-hidden="true">
            💀
          </p>
          <h2 className="text-xl font-bold text-red-400">你已被投票處決</h2>
          <p className="mt-1 text-sm text-white/50">請保持安靜，觀看大螢幕精彩對決！</p>
        </div>
      </PlayShell>
    );
  }

  return (
    <PlayShell round={`第 ${state.currentRound} 回合`}>
      <div className="text-center">
        <header className="mb-4 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-purple-400">臥底是誰？</span>
        </header>

        {/* Secret Word Card */}
        <div className="glass mb-6 rounded-3xl border border-purple-500/30 bg-purple-500/10 p-6">
          <span className="mb-1 block text-xs uppercase tracking-wider text-purple-300">
            你的秘密詞彙（請勿給他人看見）
          </span>
          <p className="text-3xl font-black tracking-widest text-white">{myWord ?? "…"}</p>
        </div>

        {state.phase === "viewing_words" && (
          <div className="py-6">
            <p className="text-sm text-white/60">請記住你的詞彙，思考待會該如何隱晦描述！</p>
          </div>
        )}

        {state.phase === "discussion" && (
          <div className="py-6">
            <p className="text-sm text-white/70">請參與現場討論，每個人輪流發言一句！</p>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="py-2">
            <p className="mb-3 text-xs text-white/60">
              {myVote ? "投票已送出，等待其他玩家！" : "選出你懷疑是臥底的玩家："}
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
                    className={`rounded-2xl border p-3 text-center transition-all ${
                      myVote === id
                        ? "border-purple-400 bg-purple-400/20 text-purple-300 ring-2 ring-purple-400"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="mb-1 block text-2xl" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="block truncate text-sm font-bold">{p.nickname}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
