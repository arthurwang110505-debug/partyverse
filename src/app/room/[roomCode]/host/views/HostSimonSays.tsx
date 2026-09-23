"use client";

import { useEffect, useRef } from "react";
import { useRoom } from "@/providers/RoomContext";
import { engineRoom } from "@/engine/participants";
import { SIMON_QUADRANTS, simonSequence } from "@/engine/simonSays";
import type { SimonGameState } from "@/engine/simonSays";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

const QUADRANT_STYLES = [
  "bg-cyan-400 shadow-[0_0_60px_rgba(34,211,238,0.8)]",
  "bg-pink-500 shadow-[0_0_60px_rgba(236,72,153,0.8)]",
  "bg-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.8)]",
  "bg-emerald-400 shadow-[0_0_60px_rgba(52,211,153,0.8)]",
];
const QUADRANT_TONES = [392, 494, 587, 698];

export default function HostSimonSays() {
  const { room } = useRoom();
  const state = room?.gameState as SimonGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  // One tone per flashed element while the learning phase runs.
  const lastIndex = useRef<string>("");
  useEffect(() => {
    if (state?.phase !== "learning") {
      lastIndex.current = "";
      return;
    }
    const key = `${state.currentRound}-${state.level}-${state.learnIndex}`;
    if (state.learnIndex > 0 && lastIndex.current !== key) {
      const seq = simonSequence(state.seqSeed, state.level);
      sfx.playTick(QUADRANT_TONES[seq[state.learnIndex - 1] % SIMON_QUADRANTS] ?? 400, 0.2);
    }
    lastIndex.current = key;
  }, [state?.phase, state?.learnIndex, state?.level, state?.seqSeed, state?.currentRound]);

  useEffect(() => {
    if (state?.phase === "result" && state.winnerId) sfx.playFanfare();
  }, [state?.phase, state?.winnerId]);

  if (!state) return null;
  const ids = Object.keys(players);
  const seq = simonSequence(state.seqSeed, state.level);
  const flashing = state.phase === "learning" && state.learnIndex > 0 ? seq[state.learnIndex - 1] : -1;
  const doneCount = ids.filter((id) => !state.outThisRound.includes(id) && !state.maxedOut.includes(id) && (state.playerProgress[id] ?? 0) >= state.level).length;

  return (
    <HostShell>
      {state.phase === "result" && state.winnerId && <Confetti />}
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-indigo-300">
            西蒙說 🔷 · 第 {state.currentRound} / {state.totalRounds} 輪 · 現在 Lv.{state.level}
          </p>
          {state.phase === "learning" && <h1 className="text-3xl font-black text-white md:text-4xl">記住這個順序！</h1>}
          {state.phase === "repeat" && <h1 className="text-3xl font-black text-white md:text-4xl">在手機上照順序點出來！</h1>}
          {state.phase === "round_reveal" && (
            <h1 className="text-3xl font-black text-emerald-300 md:text-4xl">本輪到達 Lv.{state.maxLevelReached}！</h1>
          )}
          {state.phase === "result" && state.winnerId && (
            <h1 className="text-4xl font-black text-yellow-300 md:text-6xl">
              👑 {players[state.winnerId]?.nickname} 拿下記憶王座！
            </h1>
          )}
        </header>

        <div className="mx-auto mb-8 grid w-full max-w-md grid-cols-2 gap-4" aria-label="西蒙四色方塊">
          {Array.from({ length: SIMON_QUADRANTS }, (_, q) => (
            <div
              key={q}
              className={cn(
                "aspect-square rounded-3xl border-4 transition-all duration-150",
                q === flashing ? `${QUADRANT_STYLES[q]} border-white scale-105` : "border-white/15 bg-white/5",
                state.phase === "repeat" && "opacity-80",
              )}
            />
          ))}
        </div>

        {state.phase === "learning" && (
          <div className="mb-6 flex items-center justify-center gap-2" aria-label={`第 ${state.learnIndex} / ${state.level} 格`}>
            {Array.from({ length: state.level }, (_, i) => (
              <span key={i} className={cn("h-2.5 w-2.5 rounded-full", i < state.learnIndex ? "bg-white" : "bg-white/25")} />
            ))}
          </div>
        )}

        {state.phase === "repeat" && (
          <p className="mb-6 text-lg font-bold text-white/80">
            已完成：{doneCount} / {ids.filter((id) => !state.outThisRound.includes(id)).length} 人
          </p>
        )}

        {state.phase !== "learning" && state.phase !== "result" && (
          <div className="mx-auto mb-6 max-w-xs">
            <RoundTimer
              timeLeft={state.timeLeft}
              total={state.phase === "repeat" ? 20 : 4}
              endLabel={state.phase === "repeat" ? "還沒點完的人淘汰" : "下一輪"}
              compact
            />
          </div>
        )}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.map((id) => {
            const out = state.outThisRound.includes(id);
            const maxed = state.maxedOut.includes(id);
            const progress = state.playerProgress[id] ?? 0;
            return (
              <PlayerChip
                key={id}
                avatar={players[id].avatar}
                nickname={players[id].nickname}
                score={state.currentScores[id] ?? 0}
                out={out || !players[id].isConnected}
                status={
                  !players[id].isConnected
                    ? "離線"
                    : out
                      ? "本輪淘汰"
                      : maxed
                        ? "已達滿級"
                        : state.phase === "repeat"
                          ? `Lv.${state.level} · ${progress}/${state.level}`
                          : `Lv.${state.level}`
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
