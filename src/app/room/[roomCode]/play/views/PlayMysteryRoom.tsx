"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { MysteryGameState } from "@/engine/mysteryRoom";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate, sfx } from "@/lib/sound";
import { Delete, KeyRound } from "lucide-react";

export default function PlayMysteryRoom() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as MysteryGameState | undefined;
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  if (!state || !player) return null;

  const myClue = state.playerClues?.[player.id];

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
    } catch {
      toast("送出失敗，請再試一次");
    } finally {
      setPending(false);
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
            <p className="text-xs text-white/60">口頭交流線索，輸入 4 位數密碼嘗試解鎖：</p>

            {/* Code Slots Display */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => {
                const char = code[idx];
                return (
                  <div
                    key={idx}
                    className={`flex h-14 w-12 items-center justify-center rounded-2xl border font-mono text-2xl font-black transition-all ${
                      char
                        ? "border-indigo-400 bg-indigo-500/20 text-white shadow-md shadow-indigo-500/20"
                        : "border-white/10 bg-white/5 text-white/20"
                    }`}
                  >
                    {char ?? "•"}
                  </div>
                );
              })}
            </div>

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

            <Button
              variant="accent"
              size="lg"
              className="mt-2 w-full"
              disabled={code.length !== 4}
              loading={pending}
              onClick={() => void handleSubmit()}
            >
              <KeyRound className="h-4 w-4 mr-1.5" /> 嘗試開鎖
            </Button>
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

