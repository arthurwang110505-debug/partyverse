"use client";

import { useRoom } from "@/providers/RoomContext";
import type { AIBullshitGameState } from "@/engine/aiBullshit";
import { Button } from "@/components/ui/Button";

export default function HostAiBullshit() {
  const { room, endRound, endGame } = useRoom();
  const state = room?.gameState as AIBullshitGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  return (
    <div className="mx-auto max-w-4xl text-center">
      <header className="mb-6">
        <p className="text-sm text-cyan-400 font-semibold mb-2">
          第 {state.currentRound} / {state.totalRounds} 回合 · 荒謬冷知識
        </p>
        <h1 className="text-2xl md:text-4xl font-black text-white px-4 leading-tight">
          {state.prompt?.question}
        </h1>
      </header>

      {state.phase === "submitting" && (
        <div className="my-10">
          <p className="text-7xl font-black tabular-nums text-cyan-400 mb-4 animate-pulse">
            {state.timeLeft}
          </p>
          <p className="text-lg text-white/60 mb-6">
            各位瞎扯王正在手機寫下最逼真的假答案…
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {Object.entries(players).map(([id, p]) => (
              <div
                key={id}
                className={`px-4 py-2 rounded-xl border text-sm ${
                  state.submissions[id] ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/5 text-white/40"
                }`}
              >
                {p.avatar} {p.nickname} {state.submissions[id] ? "已提交 ✍️" : "編造中…"}
              </div>
            ))}
          </div>
        </div>
      )}

      {state.phase === "voting" && (
        <div className="my-8">
          <p className="text-5xl font-black tabular-nums text-pink-400 mb-4">
            {state.timeLeft}
          </p>
          <p className="text-lg text-white/70 mb-6">辨識真偽！哪一個才是真正的冷知識？</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {state.options.map((opt, i) => (
              <div key={opt.id} className="p-4 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-white/60">
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
          <div className="p-6 rounded-3xl border border-emerald-500/50 bg-emerald-500/10 inline-block">
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-400 block mb-1">唯一正解</span>
            <p className="text-2xl md:text-3xl font-black text-white">{state.prompt.realAnswer}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto text-left">
            {state.options.map((opt) => {
              const author = opt.authorPlayerId ? players[opt.authorPlayerId] : null;
              const votesForThis = Object.entries(state.votes).filter(([, optId]) => optId === opt.id);
              return (
                <div key={opt.id} className="p-3 rounded-xl border border-white/10 bg-white/5 text-sm">
                  <div className="flex justify-between font-bold mb-1">
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

      <div className="flex justify-center gap-3 mt-8">
        <Button variant="ghost" size="md" onClick={() => void endRound()}>重開</Button>
        <Button variant="danger" size="md" onClick={() => void endGame()}>結算</Button>
      </div>
    </div>
  );
}
