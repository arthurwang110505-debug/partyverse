"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { SongGameState } from "@/engine/song3Seconds";
import { PlayShell } from "@/components/game/PlayShell";

export default function PlaySong3Seconds() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as SongGameState | undefined;

  if (!state || !player) return null;

  const myAnswer = state.playerAnswers?.[player.id];
  const options = state.currentSong?.options ?? [];

  const handleSelect = async (choice: string) => {
    try {
      await submitAction({ type: "answer", choice });
    } catch {
      toast("搶答失敗，請再試一次");
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 首`}>
      <div className="text-center">
        <header className="mb-4 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-pink-400">三秒聽歌</span>
          <h2 className="text-base font-bold text-white/80">{state.currentSong?.category}</h2>
        </header>

        {state.phase === "listen" && (
          <div className="py-12">
            <p className="mb-3 animate-pulse text-6xl" aria-hidden="true">
              🎧
            </p>
            <p className="text-lg font-bold text-white">準備聽歌搶答！</p>
          </div>
        )}

        {state.phase === "answering" && (
          <div>
            <p className="mb-4 text-xs text-white/60">
              {myAnswer ? "搶答完成！等待本題結算…" : "選擇正確歌曲名稱（越快得分越多）："}
            </p>
            <div className="space-y-3">
              {options.map((opt) => {
                const selected = myAnswer === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={selected}
                    disabled={Boolean(myAnswer)}
                    onClick={() => void handleSelect(opt)}
                    className={`w-full rounded-xl border p-4 text-center text-base font-bold transition-all ${
                      selected
                        ? "border-pink-500 bg-pink-500/20 text-pink-300 ring-2 ring-pink-500"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-95"
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
            <p className="mb-2 text-5xl" aria-hidden="true">
              🎶
            </p>
            <p className="mb-1 text-lg font-bold text-white">
              {myAnswer === state.currentSong?.title ? "🎉 恭喜答對！" : "❌ 可惜答錯了！"}
            </p>
            <p className="text-sm text-white/50">看大螢幕公布原唱與積分！</p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
