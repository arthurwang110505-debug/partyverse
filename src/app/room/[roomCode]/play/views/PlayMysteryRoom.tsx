"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { MysteryGameState } from "@/engine/mysteryRoom";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";

export default function PlayMysteryRoom() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as MysteryGameState | undefined;
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  if (!state || !player) return null;

  const myClue = state.playerClues?.[player.id];

  const handleSubmit = async () => {
    if (code.length !== 4) return;
    setPending(true);
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
            密室推理 · 合作破解
          </span>
        </header>

        {/* Secret Clue */}
        {myClue && (
          <div className="glass mb-6 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-5 text-left">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-300">
              📜 你的獨家線索：{myClue.title}
            </span>
            <p className="text-sm font-medium leading-relaxed text-white">{myClue.content}</p>
          </div>
        )}

        {state.phase === "investigation" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <p className="text-xs text-white/60">和其他玩家交流線索，輸入 4 位數密碼：</p>
            <label htmlFor="mystery-code" className="sr-only">
              4 位數密碼
            </label>
            <input
              id="mystery-code"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="輸入4位密碼"
              className="w-full rounded-xl border border-white/20 bg-white/5 p-4 text-center font-mono text-2xl tracking-widest text-white transition-colors focus:border-indigo-500 focus:outline-none"
            />
            <Button
              variant="accent"
              size="md"
              className="w-full"
              disabled={code.length !== 4}
              loading={pending}
              type="submit"
            >
              嘗試開鎖
            </Button>
          </form>
        )}

        {state.phase === "result" && (
          <div className="py-8">
            <p className="mb-2 text-5xl" aria-hidden="true">
              {state.isUnlocked ? "🔓" : "🔒"}
            </p>
            <p className="text-lg font-bold text-white">
              {state.isUnlocked ? "🎉 成功逃出密室！" : "逃脫失敗！"}
            </p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
