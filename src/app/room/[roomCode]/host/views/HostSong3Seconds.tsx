"use client";

import { engineRoom } from "@/engine/participants";

import { useEffect, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { lyricMask, type SongGameState } from "@/engine/song3Seconds";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { sfx } from "@/lib/sound";

export default function HostSong3Seconds() {
  const { room } = useRoom();
  const state = room?.gameState as SongGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  // Soft tick when a new lyric character pops into view.
  const [lastRevealed, setLastRevealed] = useState<number | null>(null);
  useEffect(() => {
    if (state?.phase === "answering" && lastRevealed !== state.lyricRevealed) {
      if (lastRevealed !== null && state.lyricRevealed > lastRevealed) sfx.playTick(1000, 0.05);
      setLastRevealed(state.lyricRevealed);
    }
  }, [state?.phase, state?.lyricRevealed, lastRevealed]);

  if (!state) return null;

  const mask = state.currentSong ? lyricMask(state.currentSong, state.lyricRevealed ?? 0) : [];

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-pink-400">
            第 {state.currentRound} / {state.totalRounds} 首 · {state.currentSong?.category}
          </p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">三秒猜歌 · 歌詞閃現 🎵</h1>
        </header>

        {state.phase === "listen" && (
          <div className="my-10">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={3} endLabel="歌詞閃現！" />
            </div>
            <p className="text-xl font-bold text-white">倒數 3 秒！準備搶答…</p>
          </div>
        )}

        {state.phase === "answering" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer
                timeLeft={state.timeLeft}
                total={Math.max(6, room?.settings?.timer ?? 8)}
                endLabel="搶答截止"
              />
            </div>
            <div className="glass mb-6 inline-block max-w-2xl rounded-3xl border border-pink-500/30 bg-pink-500/10 p-6">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-pink-300">
                歌詞閃現線索（每 2 秒解鎖 1 字）
              </span>
              <p className="text-2xl font-bold leading-relaxed tracking-wide md:text-3xl">
                {mask.map((seg, i) => (
                  <span
                    key={i}
                    className={
                      seg.shown
                        ? "text-white"
                        : "mx-0.5 inline-block min-w-[0.7em] rounded bg-white/10 px-1 align-baseline text-white/25"
                    }
                  >
                    {seg.shown ? seg.char : "▢"}
                  </span>
                ))}
              </p>
            </div>
            <p className="text-sm text-white/50">請在手機搶答！越快作答積分越高！</p>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="my-8 inline-block rounded-3xl border border-pink-500/40 bg-pink-500/10 p-6">
            <p className="mb-2 text-5xl" aria-hidden="true">
              🎉
            </p>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-pink-400">正確答案</span>
            <h2 className="mb-2 text-3xl font-black text-white">{state.currentSong?.title}</h2>
            <p className="text-lg text-white/70">原唱歌手：{state.currentSong?.artist}</p>
            <p className="mt-2 max-w-xl text-sm text-white/60">「{state.currentSong?.lyric}」</p>
          </div>
        )}

        <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => (
            <PlayerChip
              key={id}
              avatar={p.avatar}
              nickname={p.nickname}
              score={state.currentScores?.[id] ?? 0}
              highlight={Boolean(state.playerAnswers[id])}
              status={state.playerAnswers[id] ? "已搶答 ⚡" : undefined}
            />
          ))}
        </ul>

        <HostGameControls />
      </div>
    </HostShell>
  );
}
