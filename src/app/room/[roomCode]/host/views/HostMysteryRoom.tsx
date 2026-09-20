"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { MysteryGameState } from "@/engine/mysteryRoom";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";

export default function HostMysteryRoom() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as MysteryGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-1 text-sm font-semibold text-indigo-400">密室推理 🔍 · 合作解謎逃脫</p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">{state.caseTitle}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/60">{state.caseBackground}</p>
        </header>

        {state.phase === "investigation" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={Math.max(45, room?.settings?.timer ?? 60)} endLabel="時間到" />
            </div>
            <div className="glass mb-6 inline-block rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-6">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-300">
                四位數逃生密碼鎖
              </span>
              <p className="font-mono text-4xl font-black tracking-[0.4em] text-white">
                {state.submittedCode ? state.submittedCode.padEnd(4, "•") : "••••"}
              </p>
            </div>
            <p className="text-sm text-white/50">四位數線索分散在每位玩家的手機上，請口頭交流拼湊真相！</p>
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-8 inline-block rounded-3xl border border-indigo-500/40 bg-indigo-500/10 p-6">
            <p className="mb-2 text-6xl" aria-hidden="true">
              {state.isUnlocked ? "🔓" : "🔒"}
            </p>
            <h2 className="mb-2 text-3xl font-black text-white">
              {state.isUnlocked ? "🎉 成功解鎖逃脫！" : "⏰ 時間到，逃脫失敗！"}
            </h2>
            <p className="text-sm text-white/60">
              {state.isUnlocked
                ? `由 ${players[state.unlockedByPlayerId ?? ""]?.nickname} 輸入正確密碼！全體通關！`
                : "密碼是 7429"}
            </p>
          </div>
        )}

        <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => (
            <PlayerChip key={id} avatar={p.avatar} nickname={p.nickname} score={state.currentScores?.[id] ?? 0} />
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
