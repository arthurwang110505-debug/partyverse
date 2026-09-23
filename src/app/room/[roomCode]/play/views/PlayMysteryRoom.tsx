"use client";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import { maskCode, MAX_HINTS, type MysteryGameState } from "@/engine/mysteryRoom";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate, sfx } from "@/lib/sound";
import { Delete, KeyRound, Lightbulb } from "lucide-react";

export default function PlayMysteryRoom() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as MysteryGameState | undefined;
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [hintPending, setHintPending] = useState(false);
  const [wrong, setWrong] = useState(false);
  const lastWrongRef = useRef<string | null>(null);

  // A wrong attempt bounces back on the shared state: buzz + shake, then clear.
  useEffect(() => {
    const flash = state?.wrongFlash;
    if (!flash || lastWrongRef.current === flash.code) return;
    lastWrongRef.current = flash.code;
    if (flash.code === code) {
      setWrong(true);
      sfx.playBuzzer();
      vibrate([80, 40, 80]);
      window.setTimeout(() => setWrong(false), 700);
      window.setTimeout(() => setCode(""), 900);
    }
  }, [state?.wrongFlash, code]);

  if (!state || !player) return null;

  const myClue = state.playerClues?.[player.id];
  const hintsLeft = MAX_HINTS - (state.hintsUsed ?? 0);
  const revealed = maskCode(state.correctCode, state.hintRevealed ?? 0);

  const handleDigit = (digit: string) => {
    if (code.length >= 4) return;
    vibrate(10);
    sfx.playTick(900, 0.05);
    setCode((prev) => prev + digit);
  };

  const handleBackspace = () => {
    vibrate(8);
    sfx.playTick(500, 0.05);
    setCode((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    vibrate(12);
    setCode("");
  };

  const handleSubmit = async () => {
    if (code.length !== 4) return;
    setPending(true);
    vibrate(25);
    try {
      await submitAction({ type: "submitCode", code });
      setCode("");
    } catch {
      toast("送出失敗，請再試一次");
    } finally {
      setPending(false);
    }
  };

  const handleHint = async () => {
    if (hintsLeft <= 0) return;
    setHintPending(true);
    vibrate(25);
    try {
      await submitAction({ type: "requestHint" });
      sfx.playChime();
    } catch {
      toast("請求提示失敗，請再試一次");
    } finally {
      setHintPending(false);
    }
  };

  return (
    <PlayShell>
      <div className="text-center">
        <header className="mb-4 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-400">
            🔍 密室推理 · 合作破解
          </span>
          <h2 className="text-lg font-bold text-white">{state.caseTitle}</h2>
        </header>

        {/* Secret Clue */}
        {myClue && (
          <div className="glass mb-5 rounded-2xl border border-indigo-500/40 bg-indigo-950/40 p-4 text-left shadow-lg">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-300">
              📜 你的獨家線索：{myClue.title}
            </span>
            <p className="text-sm font-medium leading-relaxed text-white/90">{myClue.content}</p>
          </div>
        )}

        {state.phase === "investigation" && (
          <div className="space-y-4 py-2">
            <p className="text-xs text-white/60">大聲口頭交流線索，拼湊 4 位數密碼！答錯扣 3 秒：</p>

            {/* Hint status */}
            <div
              className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 ${
                (state.hintRevealed ?? 0) > 0
                  ? "border-amber-400/50 bg-amber-500/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                團隊提示：{revealed}
              </span>
              <span className="text-[11px] font-semibold text-white/50">
                已用 {state.hintsUsed ?? 0}/{MAX_HINTS}
              </span>
            </div>

            {/* Code Slots Display */}
            <div className={`flex justify-center gap-3 ${wrong ? "animate-shake" : ""}`}>
              {[0, 1, 2, 3].map((idx) => {
                const char = code[idx];
                return (
                  <div
                    key={idx}
                    className={`flex h-14 w-12 items-center justify-center rounded-2xl border font-mono text-2xl font-black transition-all ${
                      wrong
                        ? "border-red-500 bg-red-500/20 text-red-300"
                        : char
                          ? "border-indigo-400 bg-indigo-500/20 text-white shadow-md shadow-indigo-500/20"
                          : "border-white/10 bg-white/5 text-white/20"
                    }`}
                  >
                    {char ?? "•"}
                  </div>
                );
              })}
            </div>
            {wrong && (
              <p className="text-xs font-bold text-red-400" role="status">
                ❌ 密碼錯誤！扣 3 秒，再想想大家的線索
              </p>
            )}

            {/* Numeric Keypad */}
            <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2 pt-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(num)}
                  disabled={code.length >= 4}
                  className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl font-black text-white shadow-sm transition-all active:scale-95 active:bg-indigo-600 disabled:opacity-40"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white/60 shadow-sm active:scale-95"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleDigit("0")}
                disabled={code.length >= 4}
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl font-black text-white shadow-sm transition-all active:scale-95 active:bg-indigo-600 disabled:opacity-40"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="退格刪除"
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60 shadow-sm active:scale-95"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="accent"
                size="lg"
                className="flex-1"
                disabled={code.length !== 4}
                loading={pending}
                onClick={() => void handleSubmit()}
              >
                <KeyRound className="h-4 w-4 mr-1.5" /> 嘗試開鎖
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="border-amber-400/40 text-amber-300"
                disabled={hintsLeft <= 0}
                loading={hintPending}
                onClick={() => void handleHint()}
              >
                <Lightbulb className="h-4 w-4 mr-1.5" /> 提示（-{10}秒）
              </Button>
            </div>
          </div>
        )}

        {state.phase === "result" && (
          <div className="py-8">
            <p className="mb-2 text-6xl animate-bounce" aria-hidden="true">
              {state.isUnlocked ? "🔓" : "🔒"}
            </p>
            <h3 className="text-xl font-black text-white">
              {state.isUnlocked ? "🎉 成功逃出密室！" : "逃脫失敗！"}
            </h3>
            <p className="text-xs text-white/50 mt-1">請看大螢幕結算通關名單！</p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
