"use client";

import { engineRoom } from "@/engine/participants";

import { useEffect } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { AIBullshitGameState } from "@/engine/aiBullshit";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

export default function HostAiBullshit() {
  const { room } = useRoom();
  const state = room?.gameState as AIBullshitGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const phase = state?.phase;

  useEffect(() => {
    if (phase === "reveal") {
      sfx.playFanfare();
    } else if (phase === "voting") {
      sfx.playTick(700, 0.1);
    }
  }, [phase]);

  if (!state) return null;

  const livingPlayerCount = Object.keys(players).length;
  const submissionCount = Object.keys(state.submissions).length;
  const voteCount = Object.keys(state.votes).length;

  return (
    <HostShell>
      {state.phase === "reveal" && <Confetti />}

      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-pink-400">
            第 {state.currentRound} / {state.totalRounds} 回合 · 荒謬冷知識 🤖
          </p>
          <h1 className="px-4 text-2xl font-black leading-tight text-white md:text-4xl">{state.prompt?.question}</h1>
        </header>

        {state.phase === "submitting" && (
          <div className="my-10">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer
                timeLeft={state.timeLeft}
                total={Math.max(20, room?.settings?.timer ?? 25)}
                endLabel="提交截止"
              />
            </div>
            <p className="mb-4 text-lg text-white/70">各位瞎扯王正在手機編造最逼真的假答案…</p>

            <div className="mx-auto max-w-md mb-6">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-pink-300">
                <span>編造進度</span>
                <span>
                  {submissionCount} / {livingPlayerCount} 人已提交
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (submissionCount / Math.max(1, livingPlayerCount)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(players).map(([id, p]) => (
                <PlayerChip
                  key={id}
                  avatar={p.avatar}
                  nickname={p.nickname}
                  highlight={Boolean(state.submissions[id])}
                  status={state.submissions[id] ? "已提交 ✍️" : "苦思中…"}
                />
              ))}
            </ul>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer
                timeLeft={state.timeLeft}
                total={Math.max(15, room?.settings?.timer ?? 20)}
                endLabel="投票截止"
              />
            </div>
            <p className="mb-4 text-lg text-white/80">辨識真偽！哪一個才是真正的冷知識？</p>

            <div className="mx-auto max-w-md mb-6">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-cyan-300">
                <span>投票進度</span>
                <span>
                  {voteCount} / {livingPlayerCount} 票
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (voteCount / Math.max(1, livingPlayerCount)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 text-left md:grid-cols-2">
              {state.options.map((opt, i) => (
                <div
                  key={opt.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-500/20 font-bold text-pink-300"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="text-lg font-medium text-white">{opt.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="my-8 space-y-6">
            <div className="inline-block animate-scale-in rounded-3xl border border-emerald-500/50 bg-emerald-950/40 p-6 shadow-2xl">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-emerald-400">
                唯一真正正解
              </span>
              <p className="text-2xl font-black text-white md:text-3xl">{state.prompt.realAnswer}</p>
            </div>

            <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 text-left md:grid-cols-2">
              {state.options.map((opt) => {
                const author = opt.authorPlayerId ? players[opt.authorPlayerId] : null;
                const votesForThis = Object.entries(state.votes).filter(([, optId]) => optId === opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`rounded-2xl border p-4 text-sm transition-all shadow-md ${
                      opt.isReal ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="mb-2 flex justify-between items-center font-bold">
                      <span className={opt.isReal ? "text-emerald-300" : "text-pink-400"}>
                        {opt.isReal ? "✅ 真實答案" : `🤖 假答案作者：${author?.nickname ?? "系統"}`}
                      </span>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
                        {votesForThis.length} 人上當/答對
                      </span>
                    </div>
                    <p className="text-white/90 text-base">{opt.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <HostGameControls />
      </div>
    </HostShell>
  );
}
