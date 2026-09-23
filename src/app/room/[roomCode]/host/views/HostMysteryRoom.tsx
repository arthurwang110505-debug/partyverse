"use client";

import { engineRoom } from "@/engine/participants";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { maskCode, MAX_HINTS, WRONG_CODE_PENALTY, type MysteryGameState } from "@/engine/mysteryRoom";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

export default function HostMysteryRoom() {
  const { room } = useRoom();
  const state = room?.gameState as MysteryGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const phase = state?.phase;
  const isUnlocked = state?.isUnlocked;

  // Buzz on the TV the moment a wrong code lands.
  const lastWrongRef = useRef<string | null>(null);
  const [wrongFlashVisible, setWrongFlashVisible] = useState(false);

  useEffect(() => {
    if (phase === "result") {
      if (isUnlocked) {
        sfx.playFanfare();
      } else {
        sfx.playBuzzer();
      }
    }
  }, [phase, isUnlocked]);

  useEffect(() => {
    const flash = state?.wrongFlash;
    if (!flash || lastWrongRef.current === flash.code) return;
    lastWrongRef.current = flash.code;
    sfx.playBuzzer();
    setWrongFlashVisible(true);
    const timer = window.setTimeout(() => setWrongFlashVisible(false), 2200);
    return () => window.clearTimeout(timer);
  }, [state?.wrongFlash]);

  if (!state) return null;

  const lockedMask = maskCode(state.correctCode, state.hintRevealed ?? 0);
  const clueEntries = Object.entries(state.playerClues ?? {});

  return (
    <HostShell>
      {state.phase === "result" && state.isUnlocked && <Confetti />}

      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-1 text-sm font-semibold tracking-wider text-indigo-400">密室推理 🔍 · 合作解謎逃脫</p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">{state.caseTitle}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/60 leading-relaxed">{state.caseBackground}</p>
        </header>

        {state.phase === "investigation" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer
                timeLeft={state.timeLeft}
                total={Math.max(45, room?.settings?.timer ?? 60)}
                endLabel="時間到"
              />
            </div>
            <div className="glass mb-6 inline-block rounded-3xl border border-indigo-500/40 bg-indigo-950/40 p-8 shadow-2xl">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-indigo-300">
                四位數防護密碼鎖 · 提示已解鎖 {state.hintRevealed ?? 0}/4 位
              </span>
              <p
                className={`font-mono text-5xl font-black tracking-[0.4em] ${
                  wrongFlashVisible ? "text-red-400 animate-shake" : "text-white"
                }`}
              >
                {lockedMask}
              </p>
              {wrongFlashVisible && (
                <p className="mt-3 text-sm font-bold text-red-400" role="status">
                  ❌ 密碼錯誤！-{WRONG_CODE_PENALTY} 秒 · 已錯 {state.wrongAttempts} 次
                </p>
              )}
            </div>
            <p className="mb-6 text-sm text-white/60">
              線索分散在每位玩家的手機上，請大家互相交流、拼湊出逃生密碼！答錯 -{WRONG_CODE_PENALTY} 秒，提示 -10 秒（{state.hintsUsed ?? 0}/{MAX_HINTS} 已用）。
            </p>

            {/* Who holds which clue, so the table can keep track of the talk. */}
            {clueEntries.length > 0 && (
              <div className="mx-auto mb-2 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {clueEntries.map(([id, clue]) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left"
                  >
                    <span className="text-xl" aria-hidden="true">
                      {players[id]?.avatar ?? "❓"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white/90">{players[id]?.nickname ?? "玩家"}</p>
                      <p className="truncate text-[11px] text-indigo-300/80">📜 {clue.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-8 inline-block animate-scale-in rounded-3xl border border-indigo-400/40 bg-indigo-950/50 p-8 shadow-2xl">
            <p className="mb-2 text-6xl animate-bounce" aria-hidden="true">
              {state.isUnlocked ? "🔓" : "🔒"}
            </p>
            <h2 className="mb-2 text-3xl font-black text-white">
              {state.isUnlocked ? "🎉 成功解鎖逃脫！" : "⏰ 時間到，逃脫失敗！"}
            </h2>
            <p className="font-mono text-2xl font-black tracking-[0.3em] text-indigo-300">{state.correctCode}</p>
            <p className="text-sm text-indigo-200/80 mt-2">
              {state.isUnlocked
                ? `由 ${players[state.unlockedByPlayerId ?? ""]?.nickname} 成功輸入密碼！誤試 ${state.wrongAttempts ?? 0} 次、提示 ${state.hintsUsed ?? 0} 次。`
                : `錯誤嘗試 ${state.wrongAttempts ?? 0} 次，差一點就逃出去了…`}
            </p>
          </div>
        )}

        <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => (
            <PlayerChip key={id} avatar={p.avatar} nickname={p.nickname} score={state.currentScores?.[id] ?? 0} />
          ))}
        </ul>

        <HostGameControls />
      </div>
    </HostShell>
  );
}
