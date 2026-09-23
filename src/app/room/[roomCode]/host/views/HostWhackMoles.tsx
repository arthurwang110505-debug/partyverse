"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { engineRoom } from "@/engine/participants";
import type { MolesGameState } from "@/engine/whackMoles";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

/** The host state ticks at 1Hz; the mole windows are sub-second, so the TV
 *  grid keeps a local clock to stay smooth against the same spawn schedule. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export default function HostWhackMoles() {
  const { room } = useRoom();
  const state = room?.gameState as MolesGameState | undefined;
  const players = room ? engineRoom(room).players : {};
  const hunting = state?.phase === "hunting";
  const now = useNow(hunting ? 100 : 500);

  const lastHit = state?.lastHitPlayerId ?? null;
  useEffect(() => {
    if (lastHit && state?.phase === "hunting") sfx.playPop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastHit, state?.currentRound]);
  useEffect(() => {
    if (state?.phase === "result" && state.winnerId) sfx.playFanfare();
  }, [state?.phase, state?.winnerId]);

  if (!state) return null;
  const ids = Object.keys(players);

  const activeCell = (cell: number) =>
    hunting && state.spawns.some((s) => s.cell === cell && now >= s.startAt && now < s.endAt && s.hitBy.length === 0);

  return (
    <HostShell>
      {state.phase === "result" && state.winnerId && <Confetti />}
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-amber-300">
            敲木頭 🐹 · 第 {state.currentRound} / {state.totalRounds} 回合
          </p>
          {state.phase === "round_intro" && (
            <h1 className="animate-bounce text-4xl font-black text-white md:text-6xl">第 {state.currentRound} 回合，準備…</h1>
          )}
          {state.phase === "hunting" && (
            <h1 className="text-3xl font-black text-white md:text-4xl">木頭冒出來就敲！</h1>
          )}
          {state.phase === "round_reveal" && (
            <h1 className="text-3xl font-black text-emerald-300 md:text-4xl">本回合結束！</h1>
          )}
          {state.phase === "result" && state.winnerId && (
            <h1 className="text-4xl font-black text-yellow-300 md:text-6xl">
              👑 {players[state.winnerId]?.nickname} 是敲木頭之王！
            </h1>
          )}
        </header>

        {state.phase === "hunting" ? (
          <div className="mx-auto mb-8 grid w-full max-w-lg grid-cols-3 gap-3" aria-label="敲木頭網格">
            {Array.from({ length: 9 }, (_, cell) => (
              <div
                key={cell}
                className={`flex aspect-square items-center justify-center rounded-3xl border-2 text-6xl transition-colors md:text-7xl ${
                  activeCell(cell) ? "border-amber-300 bg-amber-500/25 shadow-[0_0_30px_rgba(251,191,36,0.4)]" : "border-white/10 bg-white/5"
                }`}
              >
                <span className={activeCell(cell) ? "animate-scale-in" : "opacity-20 grayscale"} aria-hidden="true">
                  🐹
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-auto mb-8 max-w-md">
            <RoundTimer
              timeLeft={state.timeLeft}
              total={hunting ? state.roundDuration : state.phase === "round_intro" ? 2 : 3}
              endLabel={state.phase === "round_intro" ? "開始！" : "下一回合"}
            />
          </div>
        )}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.map((id) => (
            <PlayerChip
              key={id}
              avatar={players[id].avatar}
              nickname={players[id].nickname}
              score={state.currentScores[id] ?? 0}
              status={state.phase === "hunting" ? `本回合 ${state.hits[id] ?? 0} 下` : undefined}
              highlight={state.lastHitPlayerId === id && state.phase === "hunting"}
            />
          ))}
        </ul>
        <HostGameControls />
      </div>
    </HostShell>
  );
}
