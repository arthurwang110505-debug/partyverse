"use client";

import { useRoom } from "@/providers/RoomContext";
import { BIG_BLIND, REBUY_CHIPS } from "@/engine/pokerLite";
import type { PokerGameState } from "@/engine/pokerLite";
import { useToast } from "@/providers/ToastProvider";
import { PlayShell } from "@/components/game/PlayShell";
import { PokerCard } from "@/components/game/PokerCard";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function PlayPokerLite() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as PokerGameState | undefined;
  if (!state || !player) return null;

  const myId = player.id;
  const myChips = state.chips[myId] ?? 0;
  const myCards = state.holeCards[myId] ?? [];
  const myToCall = state.toCall[myId] ?? 0;
  const myTurn = state.phase === "betting" && state.toAct === myId;
  const iFolded = state.foldedIds.includes(myId);
  const iAmAllIn = state.allInIds.includes(myId);
  const showdown = state.phase === "showdown";
  const iWon = state.potSplit[myId] ?? 0;

  const raiseOptions = (() => {
    if (!myTurn) return [];
    const committedNow = state.streetCommitted[myId] ?? 0;
    const allInTo = myChips + committedNow;
    const minTo = state.currentBet + BIG_BLIND;
    const options = new Set<number>([minTo]);
    if (allInTo > minTo) options.add(allInTo);
    const mid = state.currentBet + BIG_BLIND * 3;
    if (mid > minTo && mid < allInTo) options.add(mid);
    return [...options].filter((to) => to > committedNow).sort((a, b) => a - b);
  })();

  const act = async (action: Record<string, unknown>) => {
    vibrate(20);
    try {
      await submitAction(action);
    } catch {
      toast("沒有送出手，請再試一次");
    }
  };

  const boardRow = (
    <div className="mb-4 flex items-center justify-center gap-1.5">
      {Array.from({ length: 5 }, (_, i) => (
        <PokerCard key={i} card={state.board[i]} size="sm" />
      ))}
    </div>
  );

  const myCardsRow = myCards.length > 0 && (showdown || state.phase === "dealing" || state.phase === "betting") && !iFolded ? (
    <div className="mb-4 flex items-center justify-center gap-2">
      {myCards.map((c, i) => (
        <PokerCard key={i} card={c} size="lg" />
      ))}
      {showdown && state.showdownHands[myId] && (
        <span className="ml-2 text-base font-black text-yellow-300">{state.showdownHands[myId]}</span>
      )}
    </div>
  ) : null;

  return (
    <PlayShell round={`第 ${state.handNumber} / ${state.totalHands} 局`}>
      <div className="flex flex-1 flex-col items-center px-4 py-5 text-center">
        <div className="mb-3 flex w-full max-w-xs items-center justify-between text-sm font-bold">
          <span className="text-emerald-300">籌碼 {myChips}</span>
          {myId === state.dealerSeat && <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-black">你執荷官 D</span>}
          {iAmAllIn && !iFolded && <span className="text-amber-300">已全押</span>}
        </div>

        {state.phase === "dealing" && (
          <>
            {myCardsRow}
            <h1 className="text-2xl font-black text-white">第 {state.handNumber} 局發牌中…</h1>
            <p className="mt-2 text-sm text-white/60">大盲 {BIG_BLIND} / 小盲 1，看完你的牌準備下注！</p>
          </>
        )}

        {state.phase === "betting" && (
          <>
            {myCardsRow}
            {boardRow}
            <p className="mb-3 text-lg font-black text-emerald-300">底鍋 {state.pot}</p>

            {iFolded ? (
              <p className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white/70">你已棄牌，觀戰這局…</p>
            ) : !myTurn && !iAmAllIn ? (
              <p className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white/70">
                等待其他玩家行動…
              </p>
            ) : iAmAllIn ? (
              <p className="rounded-xl bg-amber-400/15 px-4 py-3 text-sm font-bold text-amber-300">你已全押，等開牌結果！</p>
            ) : (
              <>
                <p className="mb-2 text-sm font-black text-amber-300">你的行動！</p>
                <div className="grid w-full max-w-xs grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => void act({ type: "fold" })}
                    className="rounded-2xl bg-white/10 px-4 py-3.5 text-base font-black text-white transition-all active:scale-95"
                  >
                    棄牌
                  </button>
                  {myToCall === 0 ? (
                    <button
                      type="button"
                      onClick={() => void act({ type: "check" })}
                      className="rounded-2xl bg-emerald-400 px-4 py-3.5 text-base font-black text-black transition-all active:scale-95"
                    >
                      過牌
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void act({ type: "call" })}
                      className="rounded-2xl bg-emerald-400 px-4 py-3.5 text-base font-black text-black transition-all active:scale-95"
                    >
                      跟注 {Math.min(myToCall, myChips)}
                    </button>
                  )}
                  {raiseOptions.map((to, i) => (
                    <button
                      key={to}
                      type="button"
                      onClick={() => void act({ type: "raise", to })}
                      className={cn(
                        "rounded-2xl px-4 py-3.5 text-base font-black text-black transition-all active:scale-95",
                        i === raiseOptions.length - 1 && to >= myChips + (state.streetCommitted[myId] ?? 0)
                          ? "bg-amber-400"
                          : "bg-cyan-300",
                      )}
                    >
                      {to >= myChips + (state.streetCommitted[myId] ?? 0) ? `全押 ${to}` : `加注到 ${to}`}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <RoundTimer timeLeft={state.timeLeft} total={15} endLabel="自動行動" compact />
                </div>
              </>
            )}
          </>
        )}

        {showdown && (
          <>
            {myCardsRow}
            {boardRow}
            <h1 className="text-2xl font-black text-white">
              {iWon > 0 ? (
                <>
                  🎉 你贏了 <span className="text-emerald-300">{iWon}</span> 籌碼！
                </>
              ) : state.handWinnerIds.length > 0 ? (
                "這局的贏家見大螢幕"
              ) : (
                "開牌中…"
              )}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              {iFolded
                ? "你這局已棄牌。"
                : myChips === 0
                  ? `籌碼用完，下局自動補回 ${REBUY_CHIPS} 繼續！`
                  : `你現在有 ${myChips} 籌碼。`}
            </p>
          </>
        )}

        {state.phase === "result" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">{state.winnerId === myId ? "👑" : "🃏"}</p>
            <h1 className="text-2xl font-black text-white">
              {state.winnerId === myId ? "你就是底鍋之王！" : "比賽結束！"}
            </h1>
            <p className="mt-2 text-sm text-white/60">你最終 {myChips} 籌碼，排名看大螢幕。</p>
          </>
        )}
      </div>
    </PlayShell>
  );
}
