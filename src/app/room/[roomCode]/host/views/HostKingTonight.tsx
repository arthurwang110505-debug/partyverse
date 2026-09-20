"use client";

import { engineRoom } from "@/engine/participants";

import { useEffect } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { KingGameState } from "@/engine/kingTonight";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

export default function HostKingTonight() {
  const { room } = useRoom();
  const state = room?.gameState as KingGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const phase = state?.phase;
  const roundWinnerId = state?.roundWinnerId;

  useEffect(() => {
    if (phase === "reveal" && roundWinnerId) {
      sfx.playFanfare();
    } else if (phase === "action") {
      sfx.playTick(800, 0.15);
    }
  }, [phase, roundWinnerId]);

  if (!state) return null;

  const king = state.currentKingId ? players[state.currentKingId] : null;

  // Calculate highest tap count for relative bar width
  const maxTaps = Math.max(1, ...Object.values(state.playerInputs).map((v) => (typeof v === "number" ? v : 0)));

  return (
    <HostShell>
      {state.phase === "reveal" && Boolean(state.roundWinnerId) && <Confetti />}

      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-yellow-400">
            第 {state.currentRound} / {state.totalRounds} 場挑戰 · 今晚誰是王 👑
          </p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">{state.challenge?.title}</h1>
          <p className="mx-auto mt-2 max-w-lg text-white/60">{state.challenge?.instruction}</p>
        </header>

        {king && (
          <div className="glass mb-6 inline-flex items-center gap-3 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-6 py-2">
            <span className="text-2xl" aria-hidden="true">
              👑
            </span>
            <span className="text-sm font-bold text-yellow-300">現任王者：{king.nickname}</span>
          </div>
        )}

        {(state.phase === "briefing" || state.phase === "action") && (
          <div className="my-10">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer
                timeLeft={state.timeLeft}
                total={state.phase === "briefing" ? 4 : state.challenge?.type === "tap_mash" ? 5 : 8}
                endLabel={state.phase === "briefing" ? "開戰！" : "時間到！"}
              />
            </div>
            <p className="text-xl font-bold text-white mb-6">
              {state.phase === "briefing" ? "全員準備！即將開戰！" : "激戰進行中！在手機上拚搏！"}
            </p>

            {/* Live battlefield visualization */}
            {state.phase === "action" && state.challenge?.type === "tap_mash" && (
              <div className="mx-auto max-w-lg space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5 text-left">
                <span className="block text-xs font-bold uppercase tracking-wider text-yellow-400 mb-2">
                  ⚡ 即時狂點戰況
                </span>
                {Object.entries(players).map(([id, p]) => {
                  const taps = typeof state.playerInputs[id] === "number" ? (state.playerInputs[id] as number) : 0;
                  const percent = Math.min(100, Math.round((taps / maxTaps) * 100));
                  return (
                    <div key={id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-white/80">
                        <span>
                          {p.avatar} {p.nickname}
                        </span>
                        <span className="text-yellow-300 font-mono font-bold">{taps} 次</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-150"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {state.phase === "action" && state.challenge?.type === "reaction_tap" && (
              <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="text-5xl mb-2 animate-pulse">⚔️</div>
                <h3 className="text-xl font-black text-white">全神貫注！聽候出鞘！</h3>
                <p className="text-xs text-white/50 mt-1">誰能以毫秒之差先發制人？</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {Object.entries(players).map(([id, p]) => {
                    const hasStruck = state.playerInputs[id] !== undefined;
                    return (
                      <span
                        key={id}
                        className={`rounded-full px-3 py-1 text-xs font-bold border transition-all ${
                          hasStruck
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                            : "border-white/10 bg-white/5 text-white/40"
                        }`}
                      >
                        {p.nickname} {hasStruck ? "⚡ 已出刀" : "凝神中"}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="my-8 inline-block animate-scale-in rounded-3xl border border-yellow-400/40 bg-yellow-950/40 p-8 shadow-2xl">
            <p className="mb-2 text-6xl animate-bounce" aria-hidden="true">
              👑
            </p>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-yellow-300">勝者加冕</span>
            <h2 className="mb-2 text-3xl font-black text-white">
              {state.roundWinnerId ? players[state.roundWinnerId]?.nickname : "平手"} 登基為王！
            </h2>
            <p className="text-sm text-yellow-200/80">獲得 +25 分王者積分！</p>
          </div>
        )}

        <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => (
            <PlayerChip
              key={id}
              avatar={p.avatar}
              nickname={p.nickname}
              score={state.currentScores?.[id] ?? 0}
              highlight={id === state.currentKingId}
            />
          ))}
        </ul>

        <HostGameControls />
      </div>
    </HostShell>
  );
}
