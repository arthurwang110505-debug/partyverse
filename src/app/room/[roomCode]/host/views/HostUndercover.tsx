"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { UndercoverGameState } from "@/engine/whoIsUndercover";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";

export default function HostUndercover() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as UndercoverGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");
  const timed = state.phase === "viewing_words" || state.phase === "discussion" || state.phase === "voting";

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold text-purple-400">第 {state.currentRound} 回合 · 臥底是誰？</p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">
            {state.phase === "viewing_words" && "請全體玩家查看各自手機上的秘密詞！"}
            {state.phase === "discussion" && "🗣️ 自由發言與辯論時間"}
            {state.phase === "voting" && "🗳️ 投票處決時間！誰是臥底？"}
            {state.phase === "eliminated" && "⚖️ 處決揭曉！"}
            {state.phase === "result" && "🏆 勝負揭曉！"}
          </h1>
        </header>

        {timed && (
          <div className="my-10">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer
                timeLeft={state.timeLeft}
                total={
                  state.phase === "viewing_words"
                    ? 10
                    : state.phase === "discussion"
                      ? Math.max(30, room?.settings?.timer ?? 45)
                      : 20
                }
                endLabel="時間到"
              />
            </div>
            <p className="text-white/60">
              {state.phase === "discussion" ? "每人輪流用一句話描述你的詞，但別說破！" : "注意彼此的微表情與用詞"}
            </p>
          </div>
        )}

        {state.phase === "eliminated" && state.lastVotedOutId && (
          <div className="my-10 inline-block rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
            <p className="mb-2 text-6xl" aria-hidden="true">
              💀
            </p>
            <h2 className="mb-1 text-2xl font-black text-red-400">
              {players[state.lastVotedOutId]?.nickname} 被處決出局！
            </h2>
            <p className="text-sm text-white/60">遊戲繼續進行…</p>
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-10 inline-block rounded-3xl border border-purple-500/40 bg-purple-500/10 p-8">
            <p className="mb-2 text-6xl" aria-hidden="true">
              {state.winnerTeam === "undercover" ? "🕵️" : "🎉"}
            </p>
            <h2 className="mb-3 text-3xl font-black text-yellow-400">
              {state.winnerTeam === "undercover" ? "臥底大獲全勝！" : "平民破案大獲全勝！"}
            </h2>
            <div className="space-y-1 text-sm text-white/80">
              <p>
                平民秘密詞：<span className="font-bold text-white">{state.civilianWord}</span>
              </p>
              <p>
                臥底秘密詞：<span className="font-bold text-pink-400">{state.undercoverWord}</span>（臥底是：
                {players[state.undercoverPlayerId]?.nickname}）
              </p>
            </div>
          </div>
        )}

        <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => {
            const isOut = state.eliminatedPlayerIds.includes(id);
            return (
              <PlayerChip
                key={id}
                avatar={p.avatar}
                nickname={p.nickname}
                out={isOut}
                status={isOut ? "已淘汰" : "存活中"}
              />
            );
          })}
        </ul>

        <div className="mt-8 flex justify-center gap-3">
          <Button variant="ghost" size="md" onClick={() => endRound().catch(fail)}>
            重開
          </Button>
          <Button variant="danger" size="md" onClick={() => endGame().catch(fail)}>
            結算
          </Button>
        </div>
      </div>
    </HostShell>
  );
}
