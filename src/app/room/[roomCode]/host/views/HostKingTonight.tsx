"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { KingGameState } from "@/engine/kingTonight";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";

export default function HostKingTonight() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as KingGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const king = state.currentKingId ? players[state.currentKingId] : null;
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold text-yellow-400">
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
            <p className="text-xl font-bold text-white">
              {state.phase === "briefing" ? "全員準備！即將開戰！" : "激戰進行中！在手機上拚搏！"}
            </p>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="my-8 inline-block rounded-3xl border border-yellow-400/40 bg-yellow-400/10 p-6">
            <p className="mb-2 text-6xl" aria-hidden="true">
              👑
            </p>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-yellow-300">勝者加冕</span>
            <h2 className="mb-2 text-3xl font-black text-white">
              {state.roundWinnerId ? players[state.roundWinnerId]?.nickname : "平手"} 登基為王！
            </h2>
            <p className="text-sm text-white/60">奪下 +25 分王者積分！</p>
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
