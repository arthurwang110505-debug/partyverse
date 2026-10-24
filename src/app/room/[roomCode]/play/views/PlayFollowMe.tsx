"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useSubmitAction } from "@/hooks/useSubmitAction";
import { FOLLOW_ACTIONS, type FollowGameState } from "@/engine/followMe";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { screenNoun } from "@/lib/hostMode";

const BUTTON_STYLES = [
  "border-cyan-300 bg-cyan-400/90 active:bg-cyan-300",
  "border-pink-400 bg-pink-500/90 active:bg-pink-400",
  "border-amber-300 bg-amber-400/90 active:bg-amber-300",
  "border-emerald-300 bg-emerald-400/90 active:bg-emerald-300",
];

export default function PlayFollowMe() {
  const { room, player } = useRoom();
  const submit = useSubmitAction();
  const state = room?.gameState as FollowGameState | undefined;
  const [sending, setSending] = useState(false);
  const roundKey = `${room?.startedAt}-${state?.currentRound}-${state?.phase}`;
  useEffect(() => {
    setSending(false);
  }, [roundKey]);

  if (!state || !player) return null;
  const myAnswer = state.answers[player.id];
  const myPoints = state.roundPoints[player.id];
  const streak = state.streaks[player.id] ?? 0;
  const answered = myAnswer !== undefined;
  const command = FOLLOW_ACTIONS[state.command] ?? FOLLOW_ACTIONS[0];

  const act = async (choice: number) => {
    if (state.phase !== "command" || answered || sending) return;
    setSending(true);
    vibrate(25);
    const ok = await submit({ type: "act", choice }, { failMessage: "送出失敗，請再試一次", throttleMs: 3000 });
    if (!ok) setSending(false);
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 題${streak >= 2 ? ` · 🔥x${streak}` : ""}`}>
      <div className="flex flex-1 flex-col items-center px-4 py-5 text-center">
        {state.phase === "command" && (
          <>
            <p className="mb-1 text-sm font-bold tracking-wider text-indigo-300">{screenNoun(room)}喊什麼，就按什麼！</p>
            <div
              className={cn(
                "mb-4 flex items-center justify-center gap-3 rounded-3xl bg-gradient-to-br px-6 py-3 text-white",
                BUTTON_STYLES[state.command],
              )}
            >
              <span className="text-4xl" aria-hidden="true">
                {command.emoji}
              </span>
              <span className="text-2xl font-black">{command.label}</span>
            </div>

            {answered ? (
              myPoints !== undefined && myPoints < 0 ? (
                <p className="mt-2 w-full max-w-xs rounded-2xl bg-red-500/20 px-4 py-4 text-base font-bold text-red-300">
                  ❌ 按錯了，{myPoints} 分
                </p>
              ) : (
                <p className="mt-2 w-full max-w-xs rounded-2xl bg-emerald-500/20 px-4 py-4 text-base font-bold text-emerald-300">
                  ⚡ 抓到了！+{myPoints}
                </p>
              )
            ) : (
              <div className="w-full max-w-xs space-y-2.5">
                {FOLLOW_ACTIONS.map((a, q) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-label={a.label}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      void act(q);
                    }}
                    className={cn(
                      "flex w-full touch-manipulation select-none items-center justify-center gap-3 rounded-2xl border-4 py-5 text-2xl font-black text-black/60 transition-all active:scale-95",
                      BUTTON_STYLES[q],
                      sending && "opacity-50",
                    )}
                  >
                    <span aria-hidden="true">{a.emoji}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            {!answered && (
              <div className="mt-4">
                <RoundTimer timeLeft={state.timeLeft} total={state.commandDuration} endLabel="這題結束" compact haptic />
              </div>
            )}
          </>
        )}

        {state.phase === "reveal" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">
              {myPoints === undefined ? "😴" : myPoints < 0 ? "💥" : "⚡"}
            </p>
            <h1 className="text-2xl font-black text-white">
              {myPoints === undefined
                ? "這題沒按到！"
                : myPoints < 0
                  ? "按錯了！"
                  : `漂亮！+${myPoints} 分`}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              這題是「{command.emoji} {command.label}」
              {state.fastestId ? ` · 最快：${state.fastestId === player.id ? "就是你！" : "有人比你更快…"}` : ""}
            </p>
            {streak >= 2 && (
              <p className="mt-4 rounded-xl bg-orange-500/20 px-4 py-2 text-sm font-bold text-orange-300">
                🔥 連擊 x{streak}{streak >= 3 ? " · 加分中！" : " · 再對一題開始加分！"}
              </p>
            )}
          </>
        )}

        {state.phase === "result" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">
              {state.winnerId === player.id ? "⚡" : "👏"}
            </p>
            <h1 className="text-2xl font-black text-white">
              {state.winnerId === player.id ? "你就是手感之王！" : "比賽結束！"}
            </h1>
            <p className="mt-2 text-sm text-white/60">排名看{screenNoun(room)}。</p>
          </>
        )}
      </div>
    </PlayShell>
  );
}
