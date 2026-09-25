"use client";

import { useEffect } from "react";
import { useRoom } from "@/providers/RoomContext";
import { engineRoom } from "@/engine/participants";
import type { AmongGameState } from "@/engine/amongUs";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

/** The TV never reveals roles or unreported bodies until the right moment. */
export default function HostAmongUs() {
  const { room } = useRoom();
  const state = room?.gameState as AmongGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  useEffect(() => {
    if (state?.phase === "discussion") sfx.playBoom();
    if (state?.phase === "result") sfx.playFanfare();
  }, [state?.phase]);

  if (!state) return null;
  const ids = Object.keys(players);
  const name = (id: string | null) => (id ? `${players[id]?.avatar ?? ""} ${players[id]?.nickname ?? "玩家"}` : "");
  // Only publicly known deaths: everyone dead except bodies nobody has found yet.
  const knownDead = state.deadIds.filter((id) => !state.bodies.includes(id));
  const living = ids.filter((id) => !state.deadIds.includes(id));
  const voted = living.filter((id) => state.votes[id]).length;
  const pct = (state.tasksCompleted / Math.max(1, state.tasksTotal)) * 100;

  return (
    <HostShell>
      {state.phase === "result" && <Confetti />}
      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-2 text-sm font-semibold tracking-wider text-red-300">
          太空內鬼 🧑‍🚀 {state.currentRound > 0 && `· 第 ${state.currentRound} 輪`}
        </p>

        {state.phase === "roles" && (
          <>
            <h1 className="mb-4 text-4xl font-black text-white md:text-6xl">偷看你的手機身分！🤫</h1>
            <p className="text-lg text-white/70">這艘船上藏著 {state.impostorIds.length} 名內鬼……</p>
          </>
        )}

        {state.phase === "tasks" && (
          <>
            <h1 className="mb-6 text-3xl font-black text-white md:text-5xl">船員們，快去做任務！</h1>
            <div className="mx-auto mb-6 max-w-xl text-left">
              <div className="mb-1 flex justify-between text-sm font-bold text-emerald-300">
                <span>全船任務進度</span>
                <span>{Math.round(pct)}%</span>
              </div>
              <div className="h-5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="mx-auto mb-6 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={Math.max(45, room?.settings?.timer ?? 75)} endLabel="自動召開會議" />
            </div>
            <p className="text-white/60">發現可疑的人？在手機按「🚨 緊急會議」！</p>
          </>
        )}

        {(state.phase === "discussion" || state.phase === "voting") && (
          <>
            <h1 className="mb-3 text-4xl font-black text-amber-300 md:text-6xl">
              {state.meetingReason === "report" ? "📢 發現屍體！" : state.meetingReason === "emergency" ? "🚨 緊急會議！" : "⏰ 全員開會！"}
            </h1>
            <p className="mb-2 text-xl text-white">
              {state.meetingReason === "timeout" ? "任務時間到" : `由 ${name(state.meetingCallerId)} 召開`}
            </p>
            {state.meetingBodies.length > 0 && (
              <p className="mb-4 text-2xl font-bold text-red-300">💀 {state.meetingBodies.map(name).join("、")} 被淘汰了</p>
            )}
            <div className="mx-auto mb-4 max-w-md">
              <RoundTimer
                timeLeft={state.timeLeft}
                total={state.phase === "discussion" ? 30 : 25}
                endLabel={state.phase === "discussion" ? "開始投票" : "投票截止"}
              />
            </div>
            <p className="mb-2 text-lg text-white/80">
              {state.phase === "discussion" ? "大家說說看，誰最可疑？" : "在手機上投票！"} 已投票 {voted} / {living.length}
            </p>
          </>
        )}

        {state.phase === "ejected" && (
          <div className="my-10">
            <p className="mb-4 animate-bounce text-7xl" aria-hidden="true">
              {state.ejectedId ? "🚀" : "🤷"}
            </p>
            <h1 className="text-4xl font-black text-white md:text-6xl">
              {state.ejectedId ? `${name(state.ejectedId)} 被放逐到太空` : "平票或跳過，沒有人被放逐"}
            </h1>
            {state.ejectedId && (
              <p className={cn("mt-4 text-3xl font-black", state.ejectedWasImpostor ? "text-emerald-300" : "text-red-300")}>
                {state.ejectedWasImpostor ? "✅ 他是內鬼！" : "❌ 他不是內鬼……"}
              </p>
            )}
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-8">
            <h1 className={cn("mb-3 text-5xl font-black md:text-7xl", state.winnerTeam === "impostor" ? "text-red-400" : "text-cyan-300")}>
              {state.winnerTeam === "impostor" ? "🔪 內鬼獲勝！" : state.winnerTeam === "crew" ? "🧑‍🚀 船員獲勝！" : "遊戲結束"}
            </h1>
            {state.winReason && <p className="mb-4 text-xl text-white/80">{state.winReason}</p>}
            <p className="text-2xl font-bold text-red-300">內鬼是：{state.impostorIds.map(name).join("、")}</p>
          </div>
        )}

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.map((id) => {
            const dead = knownDead.includes(id);
            const reveal = state.phase === "result";
            return (
              <PlayerChip
                key={id}
                avatar={players[id].avatar}
                nickname={players[id].nickname}
                score={reveal ? state.currentScores[id] ?? 0 : undefined}
                out={dead}
                highlight={(state.phase === "voting" || state.phase === "discussion") && Boolean(state.votes[id])}
                status={
                  reveal
                    ? state.impostorIds.includes(id)
                      ? "🔪 內鬼"
                      : "🧑‍🚀 船員"
                    : dead
                      ? "👻 已淘汰"
                      : state.phase === "voting" || state.phase === "discussion"
                        ? state.votes[id]
                          ? "已投票 ✅"
                          : "考慮中…"
                        : undefined
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
