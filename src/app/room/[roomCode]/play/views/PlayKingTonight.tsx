"use client";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { KingGameState } from "@/engine/kingTonight";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate, sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function PlayKingTonight() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as KingGameState | undefined;
  const [taps, setTaps] = useState(0);

  // Samurai reaction state
  const [slashReady, setSlashReady] = useState(false);
  const [falseStart, setFalseStart] = useState(false);
  const slashStartTimeRef = useRef<number | null>(null);

  const challenge = state?.challenge;
  const myInput = state?.playerInputs?.[player?.id ?? ""];

  // Reset taps / reaction timer when challenge or phase changes
  useEffect(() => {
    setTaps(0);
    setSlashReady(false);
    setFalseStart(false);
    slashStartTimeRef.current = null;

    if (state?.phase === "action" && challenge?.type === "reaction_tap") {
      // Random trigger delay between 1200ms and 2400ms
      const delay = Math.floor(Math.random() * 1200) + 1200;
      const timer = setTimeout(() => {
        setSlashReady(true);
        slashStartTimeRef.current = performance.now();
        sfx.playTick(1200, 0.1);
        vibrate([30, 20, 30]);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [state?.phase, state?.currentRound, challenge?.type]);

  if (!state || !player) return null;

  const handleTap = async () => {
    setTaps((t) => t + 1);
    vibrate(10);
    try {
      await submitAction({ type: "tap" });
    } catch {
      toast("操作失敗，請再試一次");
    }
  };

  const handleSlashReaction = async () => {
    if (!slashReady) {
      // False start!
      setFalseStart(true);
      vibrate(100);
      sfx.playBuzzer();
      setTimeout(() => setFalseStart(false), 900);
      return;
    }

    if (myInput !== undefined) return;

    const reactionTime = slashStartTimeRef.current ? Math.round(performance.now() - slashStartTimeRef.current) : 300;
    vibrate(40);
    sfx.playSuccess();
    try {
      await submitAction({ type: "react", reactionTimeMs: reactionTime });
    } catch {
      toast("拔刀失敗，請再試一次");
    }
  };

  const handleMath = async (ans: string) => {
    vibrate(15);
    try {
      await submitAction({ type: "choice", answer: ans });
    } catch {
      toast("作答失敗，請再試一次");
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="text-center">
        <header className="mb-4 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-yellow-400">
            👑 今晚誰是王 · 挑戰
          </span>
          <h2 className="text-xl font-black text-white">{challenge?.title}</h2>
        </header>

        {state.phase === "briefing" && (
          <div className="py-12 animate-pulse">
            <p className="mb-3 text-5xl" aria-hidden="true">
              ⚔️
            </p>
            <p className="text-lg font-bold text-white mb-2">{challenge?.instruction}</p>
            <p className="text-xs text-white/50">雙手握穩手機，即將開戰！</p>
          </div>
        )}

        {state.phase === "action" && challenge?.type === "tap_mash" && (
          <div className="py-4">
            <button
              type="button"
              aria-label={`瘋狂點擊，已點 ${taps} 次`}
              onClick={() => void handleTap()}
              className="mx-auto flex h-52 w-52 flex-col items-center justify-center rounded-full border-4 border-yellow-300 bg-gradient-to-tr from-yellow-500 via-orange-500 to-red-500 text-4xl font-black text-white shadow-2xl transition-transform active:scale-90 select-none cursor-pointer"
            >
              <span className="drop-shadow-lg text-5xl">點！</span>
              <span className="mt-2 text-base font-black rounded-full bg-black/30 px-4 py-1">
                {taps} 次
              </span>
            </button>
            <p className="mt-4 text-xs font-semibold text-yellow-300 animate-pulse">
              🔥 狂敲螢幕！最高次數者登基為王！
            </p>
          </div>
        )}

        {state.phase === "action" && challenge?.type === "reaction_tap" && (
          <div className="py-4">
            {myInput !== undefined ? (
              <div className="py-12 rounded-3xl border border-emerald-500/40 bg-emerald-950/40 p-6">
                <p className="mb-2 text-5xl" aria-hidden="true">
                  ⚡
                </p>
                <h3 className="text-xl font-black text-emerald-300">拔刀出鞘完成！</h3>
                <p className="mt-1 text-sm text-white/70">
                  反應時間：<span className="font-bold text-yellow-300">{myInput} ms</span>
                </p>
                <p className="mt-2 text-xs text-white/50">看大螢幕揭曉誰最神速！</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleSlashReaction()}
                className={cn(
                  "flex h-64 w-full flex-col items-center justify-center rounded-3xl p-6 text-center shadow-2xl transition-all duration-150 active:scale-95 cursor-pointer select-none border",
                  falseStart
                    ? "border-red-500 bg-red-600 text-white"
                    : slashReady
                      ? "border-emerald-300 bg-emerald-500 text-white animate-pulse"
                      : "border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-900/40",
                )}
              >
                {falseStart ? (
                  <>
                    <span className="text-5xl mb-2">🚫</span>
                    <span className="text-2xl font-black">太早拔刀！偷跑犯規！</span>
                    <span className="text-xs text-white/80 mt-1">稍候重新出刀</span>
                  </>
                ) : slashReady ? (
                  <>
                    <span className="text-6xl mb-2">⚡</span>
                    <span className="text-4xl font-black tracking-widest drop-shadow-md">斬！！！</span>
                    <span className="text-sm font-bold mt-2 bg-black/30 px-3 py-1 rounded-full">
                      立刻按下！搶先拔刀！
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-5xl mb-3 animate-pulse">🔴</span>
                    <span className="text-xl font-black">凝神屏氣…</span>
                    <span className="text-xs text-white/60 mt-1">等畫面變綠並出現「斬」時立刻按！</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {state.phase === "action" && challenge?.type === "emoji_math" && (
          <div className="space-y-4 py-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-lg font-bold text-white">
                {challenge?.question ?? "🍎 + 🍌 = 5，🍎 = 2，🍌 = ？"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(challenge?.options ?? ["2", "3", "4"]).map((ans) => {
                const selected = myInput === ans;
                return (
                  <Button
                    key={ans}
                    variant={selected ? "primary" : "ghost"}
                    size="lg"
                    aria-pressed={selected}
                    disabled={myInput !== undefined}
                    onClick={() => void handleMath(ans)}
                    className={cn(
                      "py-8 text-3xl font-black transition-all",
                      selected && "ring-4 ring-yellow-400 bg-yellow-500 text-black",
                    )}
                  >
                    {ans}
                  </Button>
                );
              })}
            </div>
            {myInput !== undefined && (
              <p className="text-xs text-emerald-400 font-semibold">✓ 答案已送出，等待其他玩家！</p>
            )}
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="py-8">
            <p className="mb-2 text-5xl animate-bounce" aria-hidden="true">
              🏆
            </p>
            <p className="text-xl font-black text-yellow-400">
              {state.roundWinnerId === player.id ? "🎉 恭喜你奪得本輪王者！" : "看大螢幕公布本輪王者！"}
            </p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
