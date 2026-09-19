"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { MysteryGameState } from "@/engine/mysteryRoom";
import { Button } from "@/components/ui/Button";

export default function PlayMysteryRoom() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as MysteryGameState | undefined;
  const [code, setCode] = useState("");

  if (!state || !player) return null;

  const myClue = state.playerClues?.[player.id];

  const handleSubmit = async () => {
    if (code.length !== 4) return;
    try {
      await submitAction({ type: "submitCode", code });
    } catch {
      // Ignore
    }
  };

  return (
    <div className="mx-auto max-w-md text-center p-4">
      <header className="mb-4">
        <span className="text-xs uppercase tracking-wider text-indigo-400 font-bold block mb-1">
          密室推理 🔍 · 合作破解
        </span>
      </header>

      {/* Secret Clue */}
      {myClue && (
        <div className="glass p-5 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 text-left mb-6">
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block mb-1">
            📜 你的獨家線索：{myClue.title}
          </span>
          <p className="text-sm font-medium text-white leading-relaxed">{myClue.content}</p>
        </div>
      )}

      {state.phase === "investigation" && (
        <div className="space-y-4">
          <p className="text-xs text-white/60">和其他玩家交流線索，輸入 4 位數密碼：</p>
          <input
            type="text"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="輸入4位密碼"
            className="w-full rounded-xl border border-white/20 bg-white/5 p-4 text-white text-center text-2xl font-mono tracking-widest focus:border-indigo-500 focus:outline-none"
          />
          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={code.length !== 4}
            onClick={() => void handleSubmit()}
          >
            嘗試開鎖
          </Button>
        </div>
      )}

      {state.phase === "result" && (
        <div className="py-8">
          <p className="text-5xl mb-2">{state.isUnlocked ? "🔓" : "🔒"}</p>
          <p className="text-lg font-bold text-white">
            {state.isUnlocked ? "🎉 成功逃出密室！" : "逃脫失敗！"}
          </p>
        </div>
      )}
    </div>
  );
}
