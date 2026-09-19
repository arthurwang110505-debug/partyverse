"use client";

import { useRoom } from "@/providers/RoomContext";
import type { UndercoverGameState } from "@/engine/whoIsUndercover";

export default function PlayUndercover() {
  const { room, player, submitAction } = useRoom();
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
      // Ignore
    }
  };

  if (isEliminated) {
    return (
      <div className="mx-auto max-w-md text-center py-12 p-4">
        <p className="text-6xl mb-2">💀</p>
        <h2 className="text-xl font-bold text-red-400">你已被投票處決</h2>
        <p className="text-sm text-white/50 mt-1">請保持安靜，觀看大螢幕精彩對決！</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center p-4">
      <header className="mb-4">
        <span className="text-xs uppercase tracking-wider text-purple-400 font-bold block mb-1">
          臥底是誰？ · 第 {state.currentRound} 回合
        </span>
      </header>

      {/* Secret Word Card */}
      <div className="glass p-6 rounded-3xl border border-purple-500/30 bg-purple-500/10 mb-6">
        <span className="text-xs text-purple-300 uppercase tracking-wider block mb-1">你的秘密詞彙（請勿給他人看見）</span>
        <p className="text-3xl font-black text-white tracking-widest">{myWord ?? "…"}</p>
      </div>

      {state.phase === "viewing_words" && (
        <div className="py-6">
          <p className="text-sm text-white/60">請記住你的詞彙，思考待會該如何隱晦描述！</p>
        </div>
      )}

      {state.phase === "discussion" && (
        <div className="py-6">
          <p className="text-sm text-white/70">
            請參與現場討論，每個人輪流發言一句！
          </p>
        </div>
      )}

      {state.phase === "voting" && (
        <div className="py-2">
          <p className="text-xs text-white/60 mb-3">
            {myVote ? "投票已送出，等待其他玩家！" : "選出你懷疑是臥底的玩家："}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(players)
              .filter(([id]) => id !== player.id && !state.eliminatedPlayerIds.includes(id))
              .map(([id, p]) => (
                <button
                  key={id}
                  disabled={Boolean(myVote)}
                  onClick={() => void handleVote(id)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    myVote === id
                      ? "border-purple-400 bg-purple-400/20 text-purple-300 ring-2 ring-purple-400"
                      : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <span className="text-2xl block mb-1">{p.avatar}</span>
                  <span className="text-sm font-bold truncate block">{p.nickname}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
