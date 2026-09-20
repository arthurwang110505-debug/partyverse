"use client";

import { useEffect } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { MysteryGameState } from "@/engine/mysteryRoom";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

export default function HostMysteryRoom() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as MysteryGameState | undefined;
  const players = room?.players ?? {};

  const phase = state?.phase;
  const isUnlocked = state?.isUnlocked;

  useEffect(() => {
    if (phase === "result") {
      if (isUnlocked) {
        sfx.playFanfare();
      } else {
        sfx.playBuzzer();
      }
    }
  }, [phase, isUnlocked]);

  if (!state) return null;

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");

  return (
    <HostShell>
      {state.phase === "result" && state.isUnlocked && <Confetti />}

      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-1 text-sm font-semibold tracking-wider text-indigo-400">
            密室推理 🔍 · 合作解謎逃脫
          </p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">{state.caseTitle}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/60 leading-relaxed">{state.caseBackground}</p>
        </header>

        {state.phase === "investigation" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={Math.max(45, room?.settings?.timer ?? 60)} endLabel="時間到" />
            </div>
            <div className="glass mb-6 inline-block rounded-3xl border border-indigo-500/40 bg-indigo-950/40 p-8 shadow-2xl">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-indigo-300">
                四位數防護密碼鎖
              </span>
              <p className="font-mono text-5xl font-black tracking-[0.4em] text-white">
                {state.submittedCode ? state.submittedCode.padEnd(4, "•") : "••••"}
              </p>
            </div>
            <p className="text-sm text-white/60">
              四段密碼線索分散在每位玩家的手機上，請大家互相交流、拼湊出逃生密碼！
            </p>
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-8 inline-block animate-scale-in rounded-3xl border border-indigo-500/40 bg-indigo-950/50 p-8 shadow-2xl">
            <p className="mb-2 text-6xl animate-bounce" aria-hidden="true">
              {state.isUnlocked ? "🔓" : "🔒"}
            </p>
            <h2 className="mb-2 text-3xl font-black text-white">
              {state.isUnlocked ? "🎉 成功解鎖逃脫！" : "⏰ 時間到，逃脫失敗！"}
            </h2>
            <p className="text-sm text-indigo-200/80">
              {state.isUnlocked
                ? `由 ${players[state.unlockedByPlayerId ?? ""]?.nickname} 成功輸入密碼！全體通關！`
                : `正確逃生密碼是 ${state.correctCode ?? "7429"}`}
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

