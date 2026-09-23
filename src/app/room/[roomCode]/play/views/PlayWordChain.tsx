"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { normalizeWord, isValidLink, requiredLinkChar } from "@/engine/wordChain";
import type { ChainGameState } from "@/engine/wordChain";
import { useToast } from "@/providers/ToastProvider";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function PlayWordChain() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as ChainGameState | undefined;
  const [word, setWord] = useState("");
  const [pendingAction, setPendingAction] = useState<"submit" | "object" | "vote" | null>(null);

  // Fresh round, fresh input.
  const roundKey = state ? `${state.phase}-${state.currentRound}-${state.pending?.word ?? state.headWord}` : "idle";
  const [lastKey, setLastKey] = useState(roundKey);
  if (lastKey !== roundKey) {
    setLastKey(roundKey);
    setWord("");
  }

  if (!state || !player) return null;
  const myPending = state.pending?.playerId === player.id;
  const requiredChar = requiredLinkChar(state);
  const localValid = isValidLink(normalizeWord(word), requiredChar, state.chain);
  const voted = state.votes[player.id] !== undefined;

  const run = async (kind: "submit" | "object" | "vote", action: Record<string, unknown>) => {
    if (pendingAction) return;
    vibrate(20);
    setPendingAction(kind);
    try {
      await submitAction(action);
      if (kind === "submit") setWord("");
    } catch {
      toast("送出了問題，請再試一次");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="flex flex-1 flex-col items-center px-4 py-5 text-center">
        {state.phase === "chaining" && (
          <>
            <p
              className="text-5xl font-black tracking-widest text-white"
              aria-label={`接龍詞：${state.pending?.word ?? state.headWord}`}
            >
              {state.pending?.word ?? state.headWord}
            </p>
            <p className="mt-2 text-sm font-bold text-emerald-300">用「{requiredChar}」開頭接 2-4 個字的詞</p>

            {state.pending && !myPending && state.objectionWindow > 0 && (
              <div className="mt-4 w-full max-w-xs rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3">
                <p className="text-sm text-amber-200">
                  待確認：「{state.pending.word}」· 異議倒數 {state.objectionWindow}s
                </p>
                <button
                  type="button"
                  onClick={() => void run("object", { type: "object" })}
                  disabled={pendingAction === "object"}
                  className="mt-2 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-black transition-transform active:scale-95 disabled:opacity-50"
                >
                  ⚠️ 我要異議
                </button>
              </div>
            )}
            {myPending && (
              <p className="mt-4 w-full max-w-xs rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">
                你的詞「{state.pending!.word}」待確認中（{state.objectionWindow}s）
              </p>
            )}

            <div className="mt-5 flex w-full max-w-xs flex-col gap-2.5">
              <input
                type="text"
                inputMode="text"
                autoCapitalize="none"
                enterKeyHint="send"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder={`${requiredChar}__`}
                aria-label="輸入接龍詞"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 text-center text-2xl font-black tracking-widest text-white placeholder:text-white/30 focus:border-emerald-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void run("submit", { type: "submitWord", word: normalizeWord(word) })}
                disabled={!localValid || pendingAction === "submit"}
                className={cn(
                  "w-full rounded-2xl px-4 py-3.5 text-lg font-black transition-all active:scale-95",
                  localValid ? "bg-emerald-400 text-black" : "bg-white/10 text-white/40",
                )}
              >
                搶接！
              </button>
            </div>

            <div className="mt-4">
              <RoundTimer timeLeft={state.timeLeft} total={room?.settings.timer ?? 20} endLabel="回合結束" compact />
            </div>
          </>
        )}

        {state.phase === "voting" && state.pending && (
          <>
            <p className="text-sm font-bold text-amber-300">全場投票中</p>
            <p className="mt-2 text-4xl font-black tracking-widest text-white">{state.pending.word}</p>
            <p className="mt-2 text-sm text-white/60">
              這個詞有效嗎？{myPending ? "（你自己不能投票）" : "投出你的判斷！"}
            </p>
            <div className="mt-6 grid w-full max-w-xs grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void run("vote", { type: "voteWord", valid: true })}
                disabled={myPending || voted || pendingAction === "vote"}
                className="rounded-2xl bg-emerald-400 px-4 py-4 text-lg font-black text-black transition-transform active:scale-95 disabled:opacity-40"
              >
                有效 ✓
              </button>
              <button
                type="button"
                onClick={() => void run("vote", { type: "voteWord", valid: false })}
                disabled={myPending || voted || pendingAction === "vote"}
                className="rounded-2xl bg-red-400 px-4 py-4 text-lg font-black text-black transition-transform active:scale-95 disabled:opacity-40"
              >
                無效 ✗
              </button>
            </div>
            {voted && (
              <p role="status" className="mt-3 text-emerald-300">
                已投票，等待揭曉
              </p>
            )}
            <div className="mt-5">
              <RoundTimer timeLeft={state.timeLeft} total={4} endLabel="截止" compact />
            </div>
          </>
        )}

        {state.phase === "round_reveal" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">
              🀄
            </p>
            <h1 className="text-2xl font-black text-white">本回合結束！</h1>
            <p className="mt-2 text-sm text-white/60">
              {state.currentRound >= state.totalRounds ? "準備揭曉最終排名…" : "馬上換新詞開始下一回合…"}
            </p>
          </>
        )}

        {state.feedback && (
          <p role="status" className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-emerald-200">
            {state.feedback}
          </p>
        )}

        {state.phase === "result" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">
              {state.winnerId === player.id ? "👑" : "🀄"}
            </p>
            <h1 className="text-2xl font-black text-white">
              {state.winnerId === player.id ? "你就是接龍高手！" : "比賽結束！"}
            </h1>
            <p className="mt-2 text-sm text-white/60">排名看大螢幕。</p>
          </>
        )}
      </div>
    </PlayShell>
  );
}
