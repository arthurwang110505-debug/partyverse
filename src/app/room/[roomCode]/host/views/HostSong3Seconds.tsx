"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { SongGameState } from "@/engine/song3Seconds";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";

export default function HostSong3Seconds() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as SongGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold text-pink-400">
            第 {state.currentRound} / {state.totalRounds} 首 · {state.currentSong?.category}
          </p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">三秒聽歌猜歌名 🎵</h1>
        </header>

        {state.phase === "listen" && (
          <div className="my-10">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={3} endLabel="開始搶答！" />
            </div>
            <p className="text-xl font-bold text-white">倒數中！準備仔細聆聽線索…</p>
          </div>
        )}

        {state.phase === "answering" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={Math.max(6, room?.settings?.timer ?? 8)} endLabel="搶答截止" />
            </div>
            <div className="glass mb-6 inline-block max-w-xl rounded-3xl border border-pink-500/30 bg-pink-500/10 p-6">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-pink-300">歌詞旋律線索</span>
              <p className="text-2xl font-bold text-white">「{state.currentSong?.hint}」</p>
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
