"use client";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { SIMON_QUADRANTS, repeatSeconds, simonSequence } from "@/engine/simonSays";
import type { SimonGameState } from "@/engine/simonSays";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

const BUTTON_STYLES = [
  "border-cyan-300 bg-cyan-400/90 active:bg-cyan-300",
  "border-pink-400 bg-pink-500/90 active:bg-pink-400",
  "border-amber-300 bg-amber-400/90 active:bg-amber-300",
  "border-emerald-300 bg-emerald-400/90 active:bg-emerald-300",
];

export default function PlaySimonSays() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as SimonGameState | undefined;
  const [taps, setTaps] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [lit, setLit] = useState<{ q: number; at: number } | null>(null);
  const lastTapAt = useRef(0);
  const levelKey = `${room?.startedAt}-${state?.currentRound}-${state?.level}-${state?.phase}`;
  useEffect(() => {
    setTaps([]);
    setSending(false);
  }, [levelKey]);

  if (!state || !player) return null;
  const seq = simonSequence(state.seqSeed, state.level);
  const iAmOut = state.outThisRound.includes(player.id);
  const iAmMaxed = state.maxedOut.includes(player.id);
  const finished = !iAmOut && (state.playerProgress[player.id] ?? 0) >= state.level;
  const repeat = state.phase === "repeat";
  const canTap = repeat && !iAmOut && !iAmMaxed && !finished && !sending;
  const flashing = state.phase === "learning" && state.learnIndex > 0 ? seq[state.learnIndex - 1] : -1;

  const send = async (answer: number[]) => {
    setSending(true);
    try {
      await submitAction({ type: "submitSequence", taps: answer });
    } catch {
      setSending(false);
    }
  };

  const tap = (quadrant: number) => {
    if (!canTap) return;
    // Ignore ghost double-fires (touch + click) within 60ms.
    const t = Date.now();
    if (t - lastTapAt.current < 60) return;
    lastTapAt.current = t;
    vibrate(25);
    setLit({ q: quadrant, at: t });
    const next = [...taps, quadrant].slice(0, seq.length);
    setTaps(next);
    if (next.length === seq.length) void send(next);
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 輪 · Lv.${state.level}`}>
      <div className="flex flex-1 flex-col items-center px-4 py-6 text-center">
        {state.phase === "learning" && (
          <>
            <h1 className="text-2xl font-black text-white">記住順序！</h1>
            <p className="mt-1 text-sm text-white/60">
              共 {state.level} 格 · 第 {Math.min(state.learnIndex, state.level)} 格
            </p>
            <div className="mt-4 grid w-full max-w-[14rem] grid-cols-2 gap-3" aria-hidden="true">
              {Array.from({ length: SIMON_QUADRANTS }, (_, q) => (
                <div
                  key={`${q}-${q === flashing ? state.learnIndex : "off"}`}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-3xl border-4 text-2xl font-black text-black/60",
                    BUTTON_STYLES[q],
                    q === flashing ? "animate-simon-flash" : "opacity-25",
                  )}
                >
                  {q + 1}
                </div>
              ))}
            </div>
            {iAmMaxed && <p className="mt-4 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-300">你已達滿級，稍作休息 ✨</p>}
          </>
        )}

        {state.phase === "repeat" && !iAmOut && (
          <>
            <p className="mb-1 text-sm font-bold tracking-wider text-indigo-300">
              照順序點 · {finished ? seq.length : taps.length}/{seq.length}
            </p>
            <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
              {seq.map((_, i) => (
                <span key={i} className={cn("h-2.5 w-2.5 rounded-full", i < (finished ? seq.length : taps.length) ? "bg-white" : "bg-white/20")} />
              ))}
            </div>
            {finished ? (
              <p className="mt-6 rounded-xl bg-emerald-500/20 px-4 py-3 text-base font-bold text-emerald-300">✅ 全對！等其他人完成…</p>
            ) : sending ? (
              <p className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white/80">送出中…</p>
            ) : iAmMaxed ? (
              <p className="mt-6 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-300">你已達滿級，稍作休息 ✨</p>
            ) : (
              <div className="mt-4 grid w-full max-w-xs grid-cols-2 gap-3">
                {Array.from({ length: SIMON_QUADRANTS }, (_, q) => (
                  <button
                    key={q}
                    type="button"
                    aria-label={`色塊 ${q + 1}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      tap(q);
                    }}
                    className={cn(
                      "flex aspect-square touch-manipulation select-none items-center justify-center rounded-3xl border-4 text-3xl font-black text-black/60 transition-all active:scale-90",
                      BUTTON_STYLES[q],
                      lit?.q === q && Date.now() - lit.at < 200 && "scale-95 brightness-150",
                    )}
                  >
                    {q + 1}
                  </button>
                ))}
              </div>
            )}
            {canTap && taps.length > 0 && (
              <button
                type="button"
                onClick={() => setTaps((t) => t.slice(0, -1))}
                className="mt-4 rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-bold text-white/80 active:scale-95"
              >
                ⌫ 按錯了，退一格
              </button>
            )}
            {!iAmMaxed && !finished && (
              <div className="mt-5">
                <RoundTimer timeLeft={state.timeLeft} total={repeatSeconds(state.level)} endLabel="淘汰" compact />
              </div>
            )}
          </>
        )}

        {state.phase === "repeat" && iAmOut && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">💥</p>
            <h1 className="text-2xl font-black text-red-400">順序不對，本輪淘汰</h1>
            <p className="mt-2 text-sm text-white/60">分數保留，觀戰其他人能到第幾格！</p>
          </>
        )}

        {state.phase === "round_reveal" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">🔷</p>
            <h1 className="text-2xl font-black text-white">本輪到達 Lv.{state.maxLevelReached}</h1>
            <p className="mt-2 text-sm text-white/60">{iAmOut ? "下輪重新來過，加油！" : "下輪重新來過，序列回到 Lv.3！"}</p>
          </>
        )}

        {state.phase === "result" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">{state.winnerId === player.id ? "👑" : "🔷"}</p>
            <h1 className="text-2xl font-black text-white">
              {state.winnerId === player.id ? "你就是記憶之王！" : "比賽結束！"}
            </h1>
            <p className="mt-2 text-sm text-white/60">排名看大螢幕。</p>
          </>
        )}
      </div>
    </PlayShell>
  );
}
