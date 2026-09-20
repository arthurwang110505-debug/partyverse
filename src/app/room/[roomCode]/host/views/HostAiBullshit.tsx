"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { AIBullshitGameState } from "@/engine/aiBullshit";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";

export default function HostAiBullshit() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as AIBullshitGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold text-cyan-400">
            第 {state.currentRound} / {state.totalRounds} 回合 · 荒謬冷知識
          </p>
          <h1 className="px-4 text-2xl font-black leading-tight text-white md:text-4xl">{state.prompt?.question}</h1>
        </header>

        {state.phase === "submitting" && (
          <div className="my-10">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={Math.max(20, room?.settings?.timer ?? 25)} endLabel="提交截止" />
            </div>
            <p className="mb-6 text-lg text-white/60">各位瞎扯王正在手機寫下最逼真的假答案…</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(players).map(([id, p]) => (
                <PlayerChip
                  key={id}
                  avatar={p.avatar}
                  nickname={p.nickname}
                  highlight={Boolean(state.submissions[id])}
                  status={state.submissions[id] ? "已提交 ✍️" : "編造中…"}
                />
              ))}
            </ul>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={Math.max(15, room?.settings?.timer ?? 20)} endLabel="投票截止" />
            </div>
            <p className="mb-6 text-lg text-white/70">辨識真偽！哪一個才是真正的冷知識？</p>
            <div className="grid grid-cols-1 gap-4 text-left md:grid-cols-2">
              {state.options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-white/60"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="text-lg font-medium text-white">{opt.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="my-8 space-y-6">
            <div className="inline-block rounded-3xl border border-emerald-500/50 bg-emerald-500/10 p-6">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-emerald-400">唯一正解</span>
              <p className="text-2xl font-black text-white md:text-3xl">{state.prompt.realAnswer}</p>
            </div>
            <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 text-left md:grid-cols-2">
              {state.options.map((opt) => {
                const author = opt.authorPlayerId ? players[opt.authorPlayerId] : null;
                const votesForThis = Object.entries(state.votes).filter(([, optId]) => optId === opt.id);
                return (
                  <div key={opt.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                    <div className="mb-1 flex justify-between font-bold">
                      <span className={opt.isReal ? "text-emerald-400" : "text-pink-400"}>
                        {opt.isReal ? "✅ 真實答案" : `🤖 假答案作者：${author?.nickname ?? "系統"}`}
                      </span>
                      <span className="text-white/60">{votesForThis.length} 人上當/答對</span>
                    </div>
                    <p className="text-white/80">{opt.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
