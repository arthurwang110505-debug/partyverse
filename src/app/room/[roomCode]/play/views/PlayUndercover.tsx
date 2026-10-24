"use client";

import { engineRoom } from "@/engine/participants";

import { useMemo, useState } from "react";
import { Eye, Lock, ShieldAlert, Skull } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { useSubmitAction } from "@/hooks/useSubmitAction";
import { useGameViewState } from "@/hooks/useGameViewState";
import type { UndercoverGameState } from "@/engine/whoIsUndercover";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate, sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { screenNoun } from "@/lib/hostMode";

export default function PlayUndercover() {
  const { room, player } = useRoom();
  const submit = useSubmitAction();
  const state = useGameViewState<UndercoverGameState & { myWord?: string }>();
  const players = room ? engineRoom(room).players : {};

  const [revealed, setRevealed] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const target of Object.values(state?.votes ?? {})) {
      counts[target] = (counts[target] ?? 0) + 1;
    }
    return counts;
  }, [state?.votes]);

  if (!state || !player) return null;

  const myWord = state.myWord ?? state.playerWords?.[player.id];
  const isEliminated = state.eliminatedPlayerIds?.includes(player.id);
  const myVote = state.votes?.[player.id];
  const living = Object.entries(players).filter(
    ([id]) => id !== player.id && !state.eliminatedPlayerIds.includes(id),
  );

  const handleVote = async (targetId: string) => {
    vibrate(20);
    sfx.playPop();
    const ok = await submit(
      { type: "vote", targetPlayerId: targetId },
      { failMessage: "投票失敗，請再試一次" },
    );
    if (ok) setConfirmTarget(null);
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
          <p className="mt-1 text-sm text-white/50">請保持緘默，觀看{screenNoun(room)}精彩辯論與投票！</p>
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
          <div className="glass space-y-3 rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold text-purple-300">🗣️ 現場發言與辯論</p>
            <p className="text-xs leading-relaxed text-white/60">
              每人輪流用一句話描述詞彙——要像平民，又別把答案說破。聽誰的描述最彆扭！
            </p>
            <RoundTimer
              compact
              haptic
              timeLeft={state.timeLeft}
              total={Math.max(30, room?.settings?.timer ?? 45)}
              endLabel="進入投票"
            />
            <ul className="grid grid-cols-3 gap-2">
              {Object.entries(players)
                .filter(([id]) => !state.eliminatedPlayerIds.includes(id))
                .map(([id, p]) => (
                  <li
                    key={id}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-center text-[11px]",
                      id === player.id
                        ? "border-purple-400/40 bg-purple-500/15 text-purple-100"
                        : "border-white/10 bg-white/5 text-white/70",
                    )}
                  >
                    <span className="block text-lg" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="block truncate font-semibold">{p.nickname}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {state.phase === "eliminated" && state.lastVotedOutId && (
          <div className="glass animate-scale-in rounded-2xl border border-red-500/30 bg-red-950/40 p-4">
            <p className="text-sm font-semibold text-red-300">
              {players[state.lastVotedOutId]?.nickname} 被處決出局
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">觀戰{screenNoun(room)}，看看誰是臥底…</p>
          </div>
        )}

        {state.phase === "eliminated" && !state.lastVotedOutId && (
          <div className="glass animate-scale-in rounded-2xl border border-amber-500/30 bg-amber-950/40 p-4">
            <p className="text-sm font-semibold text-amber-300">⚖️ 平票！這回合沒有人被處決</p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">臥底還在你們中間，準備繼續投票…</p>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="py-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-white/80">
                {myVote
                  ? "✓ 指控已送出，等待其他玩家"
                  : confirmTarget
                    ? "確認要指控這個人？"
                    : "指控你心中的臥底："}
              </p>
              <RoundTimer compact haptic timeLeft={state.timeLeft} total={20} endLabel="開票" className="w-24" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {living.map(([id, p]) => {
                const selected = myVote === id || confirmTarget === id;
                const tally = voteCounts[id] ?? 0;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    disabled={Boolean(myVote)}
                    onClick={() => {
                      if (myVote) return;
                      if (confirmTarget === id) void handleVote(id);
                      else {
                        vibrate(12);
                        setConfirmTarget(id);
                      }
                    }}
                    className={cn(
                      "relative min-h-[5.5rem] rounded-2xl border p-3.5 text-center shadow-md transition-all active:scale-95",
                      myVote === id
                        ? "border-purple-400 bg-purple-500/25 text-purple-100 ring-2 ring-purple-400"
                        : confirmTarget === id
                          ? "border-red-400 bg-red-500/20 text-red-100 ring-2 ring-red-400"
                          : "border-white/10 bg-white/5 text-white hover:bg-white/10",
                    )}
                  >
                    <span className="mb-1 block text-3xl" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="block truncate text-sm font-bold">{p.nickname}</span>
                    {myVote === id && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-purple-300">
                        <Skull className="h-3 w-3" aria-hidden="true" /> 已指控
                      </span>
                    )}
                    {confirmTarget === id && !myVote && (
                      <span className="mt-1 block text-[10px] font-bold text-red-200">再點一次確認指控</span>
                    )}
                    {tally > 0 && myVote && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/50 px-1.5 text-[10px] tabular-nums text-white/70">
                        {tally}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {confirmTarget && !myVote && (
              <button
                type="button"
                className="mt-3 text-xs text-white/50 underline"
                onClick={() => setConfirmTarget(null)}
              >
                取消選擇
              </button>
            )}
          </div>
        )}

        {state.phase === "result" && (
          <div className="glass rounded-2xl border border-purple-400/30 bg-purple-950/40 p-5">
            <p className="text-4xl" aria-hidden="true">
              🏆
            </p>
            <p className="mt-2 text-sm font-bold text-white">本局結束，看{screenNoun(room)}揭曉臥底與兩個詞！</p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
