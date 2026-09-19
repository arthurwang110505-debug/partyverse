"use client";

import { useRoom } from "@/providers/RoomContext";
import type { SongGameState } from "@/engine/song3Seconds";

export default function PlaySong3Seconds() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as SongGameState | undefined;

  if (!state || !player) return null;

  const myAnswer = state.playerAnswers?.[player.id];
  const options = state.currentSong?.options ?? [];

  const handleSelect = async (choice: string) => {
    try {
      await submitAction({ type: "answer", choice });
    } catch {
      // Ignore
    }
  };

  return (
    <div className="mx-auto max-w-md text-center p-4">
      <header className="mb-4">
        <span className="text-xs uppercase tracking-wider text-pink-400 font-bold block mb-1">
          三秒聽歌 · 第 {state.currentRound} 首
        </span>
        <h2 className="text-base font-bold text-white/80">{state.currentSong?.category}</h2>
      </header>

      {state.phase === "listen" && (
        <div className="py-12">
          <p className="text-6xl mb-3 animate-pulse">🎧</p>
          <p className="text-lg font-bold text-white">準備聽歌搶答！</p>
        </div>
      )}

      {state.phase === "answering" && (
        <div>
          <p className="text-xs text-white/60 mb-4">
            {myAnswer ? "搶答完成！等待本題結算…" : "選擇正確歌曲名稱（越快得分越多）："}
          </p>
          <div className="space-y-3">
            {options.map((opt) => {
              const selected = myAnswer === opt;
              return (
                <button
                  key={opt}
                  disabled={Boolean(myAnswer)}
                  onClick={() => void handleSelect(opt)}
                  className={`w-full p-4 rounded-xl border text-center font-bold text-base transition-all ${
                    selected
                      ? "border-pink-500 bg-pink-500/20 text-pink-300 ring-2 ring-pink-500"
                      : "border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-98"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state.phase === "reveal" && (
        <div className="py-8">
          <p className="text-5xl mb-2">🎶</p>
          <p className="text-lg font-bold text-white mb-1">
            {myAnswer === state.currentSong?.title ? "🎉 恭喜答對！" : "❌ 可惜答錯了！"}
          </p>
          <p className="text-sm text-white/50">看大螢幕公布原唱與積分！</p>
        </div>
      )}
    </div>
  );
}
