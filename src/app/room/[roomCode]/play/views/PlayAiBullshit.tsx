"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { AIBullshitGameState } from "@/engine/aiBullshit";
import { Button } from "@/components/ui/Button";

export default function PlayAiBullshit() {
  const { room, player, submitAction } = useRoom();
  const [fakeInput, setFakeInput] = useState("");
  const state = room?.gameState as AIBullshitGameState | undefined;

  if (!state || !player) return null;

  const hasSubmitted = Boolean(state.submissions?.[player.id]);
  const myVote = state.votes?.[player.id];

  const handleSubmitFake = async () => {
    if (!fakeInput.trim()) return;
    try {
      await submitAction({ type: "submitBluff", text: fakeInput.trim() });
    } catch {
      // Ignore
    }
  };

  const handleVote = async (optionId: string) => {
    try {
      await submitAction({ type: "voteAnswer", optionId });
    } catch {
      // Ignore
    }
  };

  return (
    <div className="mx-auto max-w-md text-center p-4">
      <header className="mb-4">
        <span className="text-xs uppercase tracking-wider text-pink-400 font-bold block mb-1">
          AI 瞎扯王 · 第 {state.currentRound} 回合
        </span>
        <h2 className="text-lg font-bold text-white">{state.prompt?.question}</h2>
      </header>

      {state.phase === "submitting" && (
        <div className="py-4">
          {hasSubmitted ? (
            <div className="py-12">
              <p className="text-4xl mb-2">💡</p>
              <h3 className="font-bold text-white text-lg">答案已送出！</h3>
              <p className="text-sm text-white/50 mt-1">你的假答案正在等待其他玩家…</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-white/60">寫下一個煞有介事的假答案來騙大家：</p>
              <input
                type="text"
                maxLength={30}
                value={fakeInput}
                onChange={(e) => setFakeInput(e.target.value)}
                placeholder="寫下你的唬爛答案…"
                className="w-full rounded-xl border border-white/20 bg-white/5 p-4 text-white text-center text-base focus:border-pink-500 focus:outline-none"
              />
              <Button
                variant="primary"
                size="md"
                className="w-full"
                disabled={!fakeInput.trim()}
                onClick={() => void handleSubmitFake()}
              >
                送出假答案
              </Button>
            </div>
          )}
        </div>
      )}

      {state.phase === "voting" && (
        <div className="py-2">
          <p className="text-xs text-white/60 mb-3">
            {myVote ? "已送出投票！" : "選出你認為唯一的「真實答案」："}
          </p>
          <div className="space-y-2">
            {state.options.map((opt) => {
              const isMine = opt.authorPlayerId === player.id;
              const selected = myVote === opt.id;
              return (
                <button
                  key={opt.id}
                  disabled={Boolean(myVote) || isMine}
                  onClick={() => void handleVote(opt.id)}
                  className={`w-full p-4 rounded-xl border text-left text-sm font-medium transition-all ${
                    selected
                      ? "border-emerald-400 bg-emerald-400/20 text-emerald-300"
                      : isMine
                      ? "border-white/5 bg-white/5 text-white/30 cursor-not-allowed"
                      : "border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-98"
                  }`}
                >
                  {isMine && <span className="text-[10px] text-pink-400 block mb-0.5">（你的假答案）</span>}
                  {opt.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state.phase === "reveal" && (
        <div className="py-8">
          <p className="text-4xl mb-2">🎭</p>
          <p className="font-bold text-white text-base">看大螢幕揭曉騙局！</p>
        </div>
      )}
    </div>
  );
}
