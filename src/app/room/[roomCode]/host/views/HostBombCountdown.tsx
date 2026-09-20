"use client";

import { useRoom } from "@/providers/RoomContext";
import { participantIds } from "@/engine/participants";
import type { BombGameState } from "@/engine/bombCountdown";
import { HostShell } from "@/components/game/HostShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { PlayerChip } from "@/components/game/PlayerChip";
import { HostGameControls } from "@/components/game/HostGameControls";

export default function HostBombCountdown() {
  const { room } = useRoom();
  const state = room?.gameState as BombGameState | undefined;
  if (!room || !state) return null;
  const holder = room.players[state.bombHolderId];
  const ids = participantIds(room);
  const active = state.phase === "challenge";
  return (
    <HostShell>
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-bold text-orange-300">
          炸彈倒數 · 第 {state.currentRound} / {state.totalRounds} 局
        </p>
        <div className="my-6 text-7xl" aria-hidden="true">
          {state.phase === "exploded" ? "💥" : state.phase === "round_reveal" ? "🏆" : "💣"}
        </div>
        <h1 className="mb-3 text-3xl font-black md:text-5xl">
          {state.phase === "briefing"
            ? "全員就位，炸彈即將點燃"
            : state.phase === "exploded"
              ? `${room.players[state.lastEliminatedId ?? ""]?.nickname ?? "玩家"} 本局出局！`
              : state.phase === "round_reveal"
                ? state.roundWinnerId
                  ? `${room.players[state.roundWinnerId]?.nickname ?? "玩家"} 存活！+50 分`
                  : "本局無人存活"
                : `炸彈在 ${holder?.nickname ?? "玩家"} 手上`}
        </h1>
        <p className="mb-5 text-sm text-white/70">
          {active
            ? `已傳 ${state.passes} 次 · 越傳越難，倒數不停！`
            : state.phase === "round_reveal"
              ? "積分累加，下一局全員回歸。"
              : "答對 +10 分，答錯扣 1 秒，最後倖存者 +50 分。"}
        </p>
        <div className="mx-auto mb-6 max-w-md">
          <RoundTimer
            timeLeft={state.bombTimeLeft}
            total={active ? state.fuseDuration : state.phase === "round_reveal" ? 5 : 3}
            endLabel={active ? "炸彈爆炸" : "下一階段"}
          />
        </div>
        {active && state.challenge && (
          <p className="mb-6 text-2xl font-bold text-white/90">{state.challenge.question}</p>
        )}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.map((id) => {
            const p = room.players[id];
            const out = state.eliminatedPlayers.includes(id);
            return (
              <PlayerChip
                key={id}
                avatar={p.avatar}
                nickname={p.nickname}
                score={state.currentScores[id] ?? 0}
                highlight={active && id === state.bombHolderId}
                out={out}
                status={
                  !p.isConnected ? "離線" : out ? "下局回歸" : state.roundWinnerId === id ? "本局倖存者" : undefined
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
