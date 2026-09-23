"use client";

import { GAME_GUIDES } from "@/constants/gameGuides";
import { useRoom } from "@/providers/RoomContext";
import { submissionProgress } from "@/lib/gameplayFeedback";

export function GameplayFeedback({ phone = false }: { phone?: boolean }) {
  const { room, player } = useRoom();
  if (!room || room.status !== "PLAYING" || room.gameState.phase === "rules") return null;
  const guide = GAME_GUIDES[room.gameId];
  if (!guide) return null;
  const progress = submissionProgress(room, phone ? player?.id : undefined);
  return (
    <aside className="mx-auto my-4 w-full max-w-3xl rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      {progress && (
        <div role="status" className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-semibold text-cyan-200">{progress.message}</p>
          <p className="tabular-nums text-white/75">
            {progress.completed} / {progress.total} 已完成
          </p>
        </div>
      )}
      <details className="text-sm text-white/75">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
          玩法與計分提醒
        </summary>
        <p className="mt-2 leading-relaxed">{guide.controls}</p>
        <p className="mt-2 leading-relaxed text-violet-200">{guide.scoring}</p>
      </details>
    </aside>
  );
}
