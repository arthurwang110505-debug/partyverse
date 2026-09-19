"use client";

import { useRoom } from "@/providers/RoomContext";
import type { SongGameState } from "@/engine/song3Seconds";
import { Button } from "@/components/ui/Button";

export default function HostSong3Seconds() {
  const { room, endRound, endGame } = useRoom();
  const state = room?.gameState as SongGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  return (
    <div className="mx-auto max-w-4xl text-center">
      <header className="mb-6">
        <p className="text-sm text-pink-400 font-semibold mb-2">
          第 {state.currentRound} / {state.totalRounds} 首 · {state.currentSong?.category}
        </p>
        <h1 className="text-3xl md:text-5xl font-black text-white px-4">
          三秒聽歌猜歌名 🎵
        </h1>
      </header>

      {state.phase === "listen" && (
        <div className="my-10">
          <p className="text-7xl font-black tabular-nums text-pink-400 mb-4 animate-bounce">
            {state.timeLeft}
          </p>
          <p className="text-xl text-white font-bold">倒數中！準備仔細聆聽線索…</p>
        </div>
      )}

      {state.phase === "answering" && (
        <div className="my-8">
          <p className="text-6xl font-black tabular-nums text-yellow-400 mb-4 animate-pulse">
            {state.timeLeft}
          </p>
          <div className="glass p-6 rounded-3xl border border-pink-500/30 bg-pink-500/10 inline-block mb-6 max-w-xl">
            <span className="text-xs uppercase tracking-wider text-pink-300 font-bold block mb-1">歌詞旋律線索</span>
            <p className="text-2xl font-bold text-white">「{state.currentSong?.hint}」</p>
          </div>
          <p className="text-sm text-white/50">請在手機搶答！越快作答積分越高！</p>
        </div>
      )}

      {state.phase === "reveal" && (
        <div className="my-8 p-6 rounded-3xl bg-pink-500/10 border border-pink-500/40 inline-block">
          <p className="text-5xl mb-2">🎉</p>
          <span className="text-xs text-pink-400 uppercase tracking-wider font-bold block mb-1">正確答案</span>
          <h2 className="text-3xl font-black text-white mb-2">{state.currentSong?.title}</h2>
          <p className="text-lg text-white/70">原唱歌手：{state.currentSong?.artist}</p>
        </div>
      )}

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-8">
        {Object.entries(players).map(([id, p]) => (
          <li key={id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <p className="text-2xl mb-1">{p.avatar}</p>
            <p className="truncate text-sm font-medium">{p.nickname}</p>
            <p className="text-xs text-white/40">{state.currentScores?.[id] ?? 0} 分</p>
            {state.playerAnswers[id] && (
              <span className="text-[10px] text-emerald-400 block mt-1">已搶答 ⚡</span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex justify-center gap-3 mt-8">
        <Button variant="ghost" size="md" onClick={() => void endRound()}>重開</Button>
        <Button variant="danger" size="md" onClick={() => void endGame()}>結算</Button>
      </div>
    </div>
  );
}
