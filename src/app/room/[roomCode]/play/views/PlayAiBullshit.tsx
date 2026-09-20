"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { AIBullshitGameState } from "@/engine/aiBullshit";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate, sfx } from "@/lib/sound";
import { Sparkles } from "lucide-react";

const BLUFF_TIPS = [
  "用煞有介事的科學術語包裝",
  "講得像某個名人的怪異習慣",
  "寫得越像冷知識大家越容易信",
];

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
    vibrate(20);
    try {
      await submitAction({ type: "submitBluff", text: fakeInput.trim() });
      sfx.playReady();
    } catch {
      toast("送出失敗，請再試一次");
    } finally {
      setPending(false);
    }
  };

  const handleVote = async (optionId: string) => {
    vibrate(15);
    try {
      await submitAction({ type: "voteAnswer", optionId });
      sfx.playPop();
    } catch {
      toast("投票失敗，請再試一次");
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="text-center">
        <header className="mb-4 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-pink-400">
            🤖 荒謬冷知識 · AI 瞎扯王
          </span>
          <h2 className="text-lg font-bold text-white leading-snug">{state.prompt?.question}</h2>
        </header>

        {state.phase === "submitting" && (
          <div className="py-4">
            {hasSubmitted ? (
              <div className="py-12 rounded-3xl border border-pink-500/30 bg-pink-950/30 p-6">
                <p className="mb-2 text-5xl animate-bounce" aria-hidden="true">
                  💡
                </p>
                <h3 className="text-xl font-black text-white">假答案已成功埋伏！</h3>
                <p className="mt-1 text-sm text-pink-200/80">靜待其他人上鉤，請看大螢幕！</p>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmitFake();
                }}
              >
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60 text-left">
                  <div className="flex items-center gap-1.5 text-pink-300 font-bold mb-1">
                    <Sparkles className="h-3.5 w-3.5" /> 瞎扯小技巧
                  </div>
                  <p>{BLUFF_TIPS[state.currentRound % BLUFF_TIPS.length]}</p>
                </div>

                <label htmlFor="bluff-input" className="sr-only">
                  你的假答案
                </label>
                <input
                  id="bluff-input"
                  type="text"
                  maxLength={30}
                  value={fakeInput}
                  onChange={(e) => setFakeInput(e.target.value)}
                  placeholder="寫下你的唬爛假答案…"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 p-4 text-center text-base text-white transition-all focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 focus:outline-none"
                />
                <Button
                  variant="accent"
                  size="lg"
                  className="w-full"
                  disabled={!fakeInput.trim()}
                  loading={pending}
                >
                  送出假答案陷阱
                </Button>
              </form>
            )}
          </div>
        )}

        {state.phase === "voting" && (
          <div className="py-2">
            <p className="mb-3 text-xs font-semibold text-white/80">
              {myVote ? "✓ 已送出投票，等待揭曉！" : "辨識真偽！選出你認為唯一的「真實答案」："}
            </p>
            <div className="space-y-2.5">
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
                    className={`w-full rounded-2xl border p-4 text-left text-sm font-medium transition-all shadow-md ${
                      selected
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-200 ring-2 ring-emerald-400"
                        : isMine
                          ? "cursor-not-allowed border-white/5 bg-white/5 text-white/30"
                          : "border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-98"
                    }`}
                  >
                    {isMine && <span className="mb-0.5 block text-[10px] font-bold text-pink-400">（你編造的假答案）</span>}
                    <span className="text-base font-semibold">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="py-8">
            <p className="mb-2 text-5xl animate-bounce" aria-hidden="true">
              🎭
            </p>
            <h3 className="text-xl font-black text-white">大螢幕揭曉騙局中！</h3>
            <p className="text-xs text-white/60 mt-1">誰騙了最多人？誰又慧眼識破真相？</p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}

