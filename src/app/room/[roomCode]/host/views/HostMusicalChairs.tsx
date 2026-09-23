"use client";

import { useEffect } from "react";
import { useRoom } from "@/providers/RoomContext";
import { engineRoom } from "@/engine/participants";
import type { ChairsGameState } from "@/engine/musicalChairs";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

export default function HostMusicalChairs() {
  const { room } = useRoom();
  const state = room?.gameState as ChairsGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const phase = state?.phase;
  // Accelerating metronome while the music phase runs (asset-free WebAudio).
  useEffect(() => {
    if (phase !== "music" || !state) return;
    const duration = Math.max(1, state.musicDuration || state.timeLeft);
    const elapsed0 = Math.max(0, duration - state.timeLeft);
    const start = performance.now() - elapsed0 * 1000;
    let timer: number | null = null;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      sfx.playTick(520 + Math.random() * 160, 0.12);
      const elapsed = (performance.now() - start) / 1000;
      const next = Math.max(120, 340 - 220 * Math.min(1, elapsed / duration));
      timer = window.setTimeout(loop, next);
    };
    loop();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state?.currentRound]);

  useEffect(() => {
    if (phase === "round_reveal" && state?.roundEliminatedId) sfx.playBuzzer();
    if (phase === "result" && state?.lastStandId) sfx.playFanfare();
  }, [phase, state?.roundEliminatedId, state?.lastStandId]);

  if (!state) return null;
  const ids = Object.keys(players);
  const chairs = Math.max(0, state.survivors.length - 1);
  const seatedOrder = Object.entries(state.sitOrder).sort((a, b) => a[1] - b[1]).map(([id]) => id);

  return (
    <HostShell>
      {state.phase === "result" && state.lastStandId && <Confetti />}
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-cyan-300">
            音樂椅 🪑 · 第 {state.currentRound} / {state.totalRounds} 回合
          </p>

          {state.phase === "briefing" && (
            <>
              <h1 className="text-3xl font-black text-white md:text-5xl">準備坐椅子！</h1>
              <p className="mt-3 text-lg text-white/70">本回合有 {chairs} 把椅子，比人少 1 把！</p>
            </>
          )}

          {state.phase === "music" && (
            <>
              <h1 className="text-3xl font-black text-white md:text-5xl">🎶 音樂進行中…</h1>
              <p className="mt-3 text-lg text-white/70">節拍越演越快——停了就快點「坐下」！</p>
            </>
          )}

          {state.phase === "sit" && (
            <>
              <h1 className="animate-pulse text-4xl font-black text-amber-300 md:text-6xl">音樂停了！</h1>
              <p className="mt-3 text-lg text-white/80">點得最慢的人沒有椅子！</p>
              <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
                {seatedOrder.length === 0 ? (
                  <span className="text-sm text-white/50">還在等玩家坐下…</span>
                ) : (
                  seatedOrder.map((id, i) => (
                    <span
                      key={id}
                      className="animate-scale-in rounded-full border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-sm font-bold text-cyan-100"
                    >
                      {i + 1}. {players[id]?.avatar} {players[id]?.nickname}
                    </span>
                  ))
                )}
              </div>
            </>
          )}

          {state.phase === "round_reveal" && state.roundEliminatedId && (
            <>
              <h1 className="text-3xl font-black text-red-400 md:text-5xl">
                {players[state.roundEliminatedId]?.avatar} {players[state.roundEliminatedId]?.nickname} 站着出局！
              </h1>
              <p className="mt-3 text-lg text-white/70">倖存者各 +10 分，下一把椅子馬上開始…</p>
            </>
          )}

          {state.phase === "result" && state.lastStandId && (
            <>
              <h1 className="text-4xl font-black text-yellow-300 md:text-6xl">
                👑 {players[state.lastStandId]?.nickname} 是音樂椅之王！
              </h1>
              <p className="mt-3 text-lg text-white/70">撐到最後一把椅子的人出現了！</p>
            </>
          )}
        </header>

        {state.phase !== "result" && (
          <div className="mx-auto mb-6 max-w-md">
            <RoundTimer
              timeLeft={state.timeLeft}
              total={state.phase === "music" ? Math.max(1, state.musicDuration || state.timeLeft) : state.phase === "sit" ? 3 : 3}
              endLabel={state.phase === "music" ? "音樂停止" : state.phase === "sit" ? "沒有椅子！" : "下一階段"}
            />
          </div>
        )}

        {state.phase === "music" && (
          <div className="mb-8 flex flex-wrap items-end justify-center gap-4" aria-label={`${chairs} 把椅子`}>
            {Array.from({ length: chairs }, (_, i) => (
              <span key={i} className="animate-bounce text-6xl md:text-7xl" style={{ animationDelay: `${i * 90}ms` }} aria-hidden="true">
                🪑
              </span>
            ))}
          </div>
        )}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.map((id) => {
            const out = state.eliminatedPlayerIds.includes(id);
            const seated = seatedOrder.indexOf(id);
            return (
              <PlayerChip
                key={id}
                avatar={players[id].avatar}
                nickname={players[id].nickname}
                score={state.currentScores[id] ?? 0}
                out={out || !players[id].isConnected}
                status={!players[id].isConnected ? "離線" : out ? "出局" : state.phase === "sit" && seated >= 0 ? `已坐 #${seated + 1}` : state.phase === "result" && state.lastStandId === id ? "冠軍" : undefined}
              />
            );
          })}
        </ul>
        <HostGameControls />
      </div>
    </HostShell>
  );
}
