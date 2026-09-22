"use client";

import { useEffect, useRef } from "react";
import { useRoom } from "@/providers/RoomContext";
import { engineRoom } from "@/engine/participants";
import { BIG_BLIND } from "@/engine/pokerLite";
import type { PokerGameState } from "@/engine/pokerLite";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { PokerCard } from "@/components/game/PokerCard";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

const STREET_NAMES: Record<string, string> = {
  preflop: "翻牌前",
  flop: "翻牌",
  turn: "轉牌",
  river: "河牌",
};

export default function HostPokerLite() {
  const { room } = useRoom();
  const state = room?.gameState as PokerGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const boardLen = state?.board.length ?? 0;
  const lastBoard = useRef(0);
  useEffect(() => {
    if (boardLen > lastBoard.current && boardLen > 0) sfx.playPop();
    lastBoard.current = boardLen;
  }, [boardLen]);
  useEffect(() => {
    if (state?.phase === "result" && state.winnerId) sfx.playFanfare();
  }, [state?.phase, state?.winnerId]);

  if (!state) return null;
  const ids = state.seats.length ? state.seats : Object.keys(players);
  const showdown = state.phase === "showdown";

  return (
    <HostShell>
      {state.phase === "result" && state.winnerId && <Confetti />}
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-5">
          <p className="mb-2 text-sm font-semibold tracking-wider text-indigo-300">
            快速撲克 🃏 · 第 {state.handNumber} / {state.totalHands} 局
            {state.phase === "betting" && ` · ${STREET_NAMES[state.street] ?? state.street}`}
          </p>
          {state.phase === "dealing" && <h1 className="text-3xl font-black text-white md:text-5xl">發牌中…</h1>}
          {state.phase === "betting" && (
            <h1 className="text-2xl font-black text-white md:text-4xl">
              {state.toAct ? (
                <>
                  等待 <span className="text-amber-300">{players[state.toAct]?.nickname}</span> 行動
                </>
              ) : (
                "計算中…"
              )}
            </h1>
          )}
          {showdown && (
            <h1 className="text-3xl font-black text-yellow-300 md:text-5xl">
              開牌！{state.handWinnerIds.length > 0 && `贏家：${state.handWinnerIds.map((id) => players[id]?.nickname).join("、")}`}
            </h1>
          )}
          {state.phase === "result" && state.winnerId && (
            <h1 className="text-4xl font-black text-yellow-300 md:text-6xl">
              👑 {players[state.winnerId]?.nickname} 是底鍋之王！
            </h1>
          )}
        </header>

        {/* Board: dealt cards face-up, the rest as backs. */}
        <div className="mb-5 flex items-center justify-center gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <PokerCard key={i} card={state.board[i]} size="md" />
          ))}
        </div>

        <p className="mb-5 text-xl font-black text-emerald-300">
          底鍋 {state.pot}
          {showdown && Object.keys(state.potSplit).length > 0 && (
            <span className="ml-3 text-sm font-bold text-white/60">
              分配：{Object.entries(state.potSplit)
                .map(([id, amt]) => `${players[id]?.nickname} +${amt}`)
                .join(" · ")}
            </span>
          )}
        </p>

        {state.phase === "betting" && (
          <div className="mx-auto mb-5 max-w-xs">
            <RoundTimer timeLeft={state.timeLeft} total={15} endLabel="逾時自動行動" compact />
          </div>
        )}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.map((id) => {
            const p = players[id];
            const folded = state.foldedIds.includes(id);
            const allIn = state.allInIds.includes(id);
            const toAct = state.toAct === id;
            const betting = state.phase === "betting";
            const status = !p?.isConnected
              ? "離線"
              : folded
                ? "棄牌"
                : allIn
                  ? "全押"
                  : betting && toAct
                    ? (state.toCall[id] ?? 0) > 0 ? `要跟 ${state.toCall[id]}` : "行動中…"
                    : betting && (state.toCall[id] ?? 0) > 0
                      ? `跟 ${state.toCall[id]}`
                      : betting && (state.streetCommitted[id] ?? 0) > 0
                        ? `押 ${state.streetCommitted[id]}`
                        : undefined;
            return (
              <div
                key={id}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-all",
                  toAct ? "border-amber-300 bg-amber-400/10 shadow-[0_0_25px_rgba(252,211,77,0.25)]" : "border-white/10 bg-white/5",
                  folded && "opacity-40",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">{p?.avatar ?? "❓"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                    {p?.nickname ?? id}
                    {id === state.dealerSeat && state.phase !== "result" && <span className="ml-1 rounded bg-white/15 px-1 text-[10px] font-black">D</span>}
                  </span>
                  <span className="text-sm font-black text-emerald-300">{state.chips[id] ?? 0}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {showdown &&
                    state.activePlayers.includes(id) &&
                    state.holeCards[id]?.map((c, i) => (
                      <PokerCard key={i} card={c} size="sm" />
                    ))}
                  {showdown && state.showdownHands[id] && (
                    <span className="ml-1 text-xs font-black text-yellow-300">{state.showdownHands[id]}</span>
                  )}
                  {status && <span className="ml-auto text-[11px] font-bold text-white/60">{status}</span>}
                </div>
              </div>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] text-white/35">大盲 {BIG_BLIND} / 小盲 1 · 逾時自動跟注或過牌 · 破產者下局補 50 籌碼</p>
        <HostGameControls />
      </div>
    </HostShell>
  );
}
