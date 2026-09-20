"use client";

import { engineRoom } from "@/engine/participants";

import { useEffect } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { UndercoverGameState } from "@/engine/whoIsUndercover";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

export default function HostUndercover() {
  const { room } = useRoom();
  const state = room?.gameState as UndercoverGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const phase = state?.phase;

  // Play sound effects upon dramatic phase transitions
  useEffect(() => {
    if (phase === "eliminated") {
      sfx.playBoom();
    } else if (phase === "result") {
      sfx.playFanfare();
    }
  }, [phase]);

  if (!state) return null;

  const timed = state.phase === "viewing_words" || state.phase === "discussion" || state.phase === "voting";

  const livingPlayerIds = Object.keys(players).filter((id) => !state.eliminatedPlayerIds.includes(id));
  const voteCount = Object.keys(state.votes).length;

  return (
    <HostShell>
      {state.phase === "result" && <Confetti />}

      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-purple-400">
            第 {state.currentRound} 回合 · 臥底是誰？
          </p>
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

            {state.phase === "voting" ? (
              <div className="mx-auto max-w-md">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-purple-300">
                  <span>投票進度</span>
                  <span>
                    {voteCount} / {livingPlayerIds.length} 票
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (voteCount / Math.max(1, livingPlayerIds.length)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-white/60">
                {state.phase === "discussion"
                  ? "每人輪流用一句話隱晦描述你的詞，但別說破！"
                  : "注意身邊好友的微表情與神態"}
              </p>
            )}
          </div>
        )}

        {state.phase === "eliminated" && state.lastVotedOutId && (
          <div className="my-10 inline-block animate-scale-in rounded-3xl border border-red-500/40 bg-red-950/40 p-8 shadow-2xl">
            <p className="mb-2 text-6xl animate-bounce" aria-hidden="true">
              💀
            </p>
            <h2 className="mb-2 text-2xl font-black text-red-400">
              {players[state.lastVotedOutId]?.nickname} 被處決出局！
            </h2>
            <p className="text-sm text-white/70">遊戲尚未結束，倖存平民與臥底繼續對決…</p>
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-10 inline-block animate-scale-in rounded-3xl border border-purple-500/40 bg-purple-950/50 p-8 shadow-2xl">
            <p className="mb-2 text-6xl" aria-hidden="true">
              {state.winnerTeam === "undercover" ? "🕵️" : "🎉"}
            </p>
            <h2 className="mb-4 text-3xl font-black text-yellow-400">
              {state.winnerTeam === "undercover" ? "臥底成功瞞天過海，大獲全勝！" : "平民明察秋毫，成功揪出臥底！"}
            </h2>
            <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4 text-left space-y-2 text-sm text-white/90">
              <div className="flex justify-between items-center">
                <span className="text-white/60">平民秘密詞：</span>
                <span className="font-bold text-white">{state.civilianWord}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60">臥底秘密詞：</span>
                <span className="font-bold text-pink-400">{state.undercoverWord}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/10 pt-2">
                <span className="text-white/60">隱藏臥底：</span>
                <span className="font-bold text-yellow-300">
                  {players[state.undercoverPlayerId]?.nickname ?? "未知"}
                </span>
              </div>
            </div>
          </div>
        )}

        <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => {
            const isOut = state.eliminatedPlayerIds.includes(id);
            const hasVoted = Boolean(state.votes[id]);
            return (
              <PlayerChip
                key={id}
                avatar={p.avatar}
                nickname={p.nickname}
                out={isOut}
                status={
                  isOut ? "已淘汰 💀" : state.phase === "voting" ? (hasVoted ? "已投票 ✓" : "思考中…") : "存活中 🛡️"
                }
              />
            );
          })}
        </ul>

        <HostGameControls />
      </div>
    </HostShell>
  );
}
