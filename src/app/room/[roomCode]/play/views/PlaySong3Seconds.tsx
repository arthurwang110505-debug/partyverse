"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { SongGameState } from "@/engine/song3Seconds";
import { PlayShell } from "@/components/game/PlayShell";
import { Headphones, Music2, Sparkles, Zap } from "lucide-react";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function PlaySong3Seconds() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as SongGameState | undefined;

  if (!state || !player) return null;

  const myAnswer = state.playerAnswers?.[player.id];
  const options = state.currentSong?.options ?? [];
  const isCorrect = myAnswer === state.currentSong?.title;

  const handleSelect = async (choice: string) => {
    vibrate(20);
    try {
      await submitAction({ type: "answer", choice });
    } catch {
      toast("搶答失敗，請再試一次");
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 首`}>
      <div className="text-center pt-2">
        <header className="mb-4">
          <span className="mb-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Music2 className="h-3.5 w-3.5" /> 猜歌三秒鐘
          </span>
          <div className="glass rounded-full border border-white/10 px-4 py-1.5 inline-block mt-1">
            <span className="text-xs text-white/70">分類：{state.currentSong?.category}</span>
          </div>
        </header>

        {state.phase === "listen" && (
          <div className="py-10 glass-card rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-xl">
            <div className="relative mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 shadow-inner">
              <Headphones className="h-14 w-14 animate-pulse" aria-hidden="true" />
              <span className="absolute inset-0 rounded-full border border-emerald-400/40 animate-ping opacity-40" />
            </div>
            <p className="text-xl font-black text-white">仔細聽大螢幕播放前奏！</p>
            <p className="mt-1 text-xs text-white/50">只有三秒鐘！準備在手機上按鍵搶答！</p>
          </div>
        )}

        {state.phase === "answering" && (
          <div>
            <p className="mb-3 text-xs font-semibold text-white/80 flex items-center justify-center gap-1">
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              {myAnswer ? "✓ 搶答已送出！等待本題結算…" : "越快選對得分越高！請點選正確歌名："}
            </p>
            <div className="space-y-2.5">
              {options.map((opt) => {
                const selected = myAnswer === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={selected}
                    disabled={Boolean(myAnswer)}
                    onClick={() => void handleSelect(opt)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-center text-base font-bold transition-all shadow-md active:scale-95",
                      selected
                        ? "border-emerald-400 bg-emerald-500/25 text-emerald-200 ring-2 ring-emerald-400"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20",
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="py-8 glass rounded-3xl border border-white/10 p-6 shadow-xl animate-scale-in">
            <p className="mb-2 text-5xl" aria-hidden="true">
              {isCorrect ? "🎉" : "😅"}
            </p>
            <p className="mb-1 text-2xl font-black text-white">
              {isCorrect ? "答對了！恭喜得分！" : "可惜答錯了！"}
            </p>
            <div className="my-3 rounded-2xl bg-white/5 p-3 border border-white/5">
              <p className="text-xs text-white/40">正解歌曲</p>
              <p className="text-lg font-bold text-emerald-300">{state.currentSong?.title}</p>
              <p className="text-xs text-white/60">原唱：{state.currentSong?.artist}</p>
            </div>
            <p className="text-xs text-white/40 flex items-center justify-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              請看電視大螢幕即時積分排行榜！
            </p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
