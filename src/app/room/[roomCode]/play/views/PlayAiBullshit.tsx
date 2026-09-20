"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { AIBullshitGameState } from "@/engine/aiBullshit";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";

export default function PlayAiBullshit() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const [fakeInput, setFakeInput] = useState("");
  const [pending, setPending] = useState(false);
  const state = room?.gameState as AIBullshitGameState | undefined;

  if (!state || !player) return null;

  const hasSubmitted = Boolean(state.submissions?.[player.id]);
  const myVote = state.votes?.[player.id];

  const handleSubmitFake = async () => {
    if (!fakeInput.trim()) return;
    setPending(true);
    try {
      await submitAction({ type: "submitBluff", text: fakeInput.trim() });
    } catch {
      toast("送出失敗，請再試一次");
    } finally {
      setPending(false);
    }
  };

  const handleVote = async (optionId: string) => {
    try {
      await submitAction({ type: "voteAnswer", optionId });
    } catch {
      toast("投票失敗，請再試一次");
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="text-center">
        <header className="mb-4 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-pink-400">AI 瞎扯王</span>
          <h2 className="text-lg font-bold text-white">{state.prompt?.question}</h2>
        </header>

        {state.phase === "submitting" && (
          <div className="py-4">
            {hasSubmitted ? (
              <div className="py-12">
                <p className="mb-2 text-4xl" aria-hidden="true">
                  💡
                </p>
                <h3 className="text-lg font-bold text-white">答案已送出！</h3>
                <p className="mt-1 text-sm text-white/50">你的假答案正在等待其他玩家…</p>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmitFake();
                }}
              >
                <p className="text-xs text-white/60">寫下一個煞有介事的假答案來騙大家：</p>
                <label htmlFor="bluff-input" className="sr-only">
                  你的假答案
                </label>
                <input
                  id="bluff-input"
                  type="text"
                  maxLength={30}
                  value={fakeInput}
                  onChange={(e) => setFakeInput(e.target.value)}
                  placeholder="寫下你的唬爛答案…"
                  className="w-full rounded-xl border border-white/20 bg-white/5 p-4 text-center text-base text-white transition-colors focus:border-pink-500 focus:outline-none"
                />
                <Button variant="accent" size="md" className="w-full" disabled={!fakeInput.trim()} loading={pending}>
                  送出假答案
                </Button>
              </form>
            )}
          </div>
        )}

        {state.phase === "voting" && (
          <div className="py-2">
            <p className="mb-3 text-xs text-white/60">
              {myVote ? "已送出投票！" : "選出你認為唯一的「真實答案」："}
            </p>
            <div className="space-y-2">
              {state.options.map((opt) => {
                const isMine = opt.authorPlayerId === player.id;
                const selected = myVote === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={Boolean(myVote) || isMine}
                    onClick={() => void handleVote(opt.id)}
                    className={`w-full rounded-xl border p-4 text-left text-sm font-medium transition-all ${
                      selected
                        ? "border-emerald-400 bg-emerald-400/20 text-emerald-300"
                        : isMine
                          ? "cursor-not-allowed border-white/5 bg-white/5 text-white/30"
                          : "border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-95"
                    }`}
                  >
                    {isMine && <span className="mb-0.5 block text-[10px] text-pink-400">（你的假答案）</span>}
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="py-8">
            <p className="mb-2 text-4xl" aria-hidden="true">
              🎭
            </p>
            <p className="text-base font-bold text-white">看大螢幕揭曉騙局！</p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
