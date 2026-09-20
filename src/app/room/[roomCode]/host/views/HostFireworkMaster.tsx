"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { FireworkGameState } from "@/engine/fireworkMaster";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";

export default function HostFireworkMaster() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as FireworkGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold text-cyan-400">煙火大師 🎆 · 創意競賽</p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">
            {state.phase === "designing" && "玩家正在手機調配專屬煙火…"}
            {state.phase === "show" && "✨ 全體煙火聯合大匯演 ✨"}
            {state.phase === "voting" && "🗳️ 投票評選你最喜愛的煙火！"}
            {state.phase === "result" && "🏆 最佳煙火設計大師！"}
          </h1>
        </header>

        {state.phase === "designing" && (
          <div className="my-10">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={Math.max(25, room?.settings?.timer ?? 30)} endLabel="設計截止" />
            </div>
            <p className="text-white/60">在手機上選擇顏色、火花形狀與特效</p>
          </div>
        )}

        {state.phase === "show" && (
          <div className="relative my-8 flex h-64 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/60">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-around">
              {Object.entries(state.designs).map(([id, d], i) => (
                <div key={id} className="motion-safe:animate-bounce" style={{ animationDuration: `${0.8 + (i % 3) * 0.4}s` }}>
                  <div
                    className="h-16 w-16 rounded-full blur-sm"
                    style={{ backgroundColor: d.color, boxShadow: `0 0 40px ${d.color}` }}
                  />
                  <p className="mt-2 text-center text-xs font-bold text-white/80">{players[id]?.nickname}</p>
                </div>
              ))}
            </div>
            <p className="z-10 animate-pulse text-2xl font-black text-yellow-300">
              🎆 夜空綻放中！剩餘 {state.timeLeft} 秒 🎆
            </p>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={15} endLabel="投票截止" />
            </div>
            <p className="text-lg text-white">請在手機投下你最欣賞的設計！</p>
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-8 inline-block rounded-3xl border border-cyan-400/40 bg-cyan-500/10 p-6">
            <p className="mb-2 text-6xl" aria-hidden="true">
              🎆
            </p>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-cyan-300">人氣總冠軍</span>
            <h2 className="mb-2 text-3xl font-black text-white">
              {state.winnerId ? players[state.winnerId]?.nickname : "全體大師"} 贏得最佳煙火賞！
            </h2>
            <p className="text-sm text-white/60">獲得 {state.voteCounts[state.winnerId ?? ""] ?? 0} 票肯定！</p>
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
