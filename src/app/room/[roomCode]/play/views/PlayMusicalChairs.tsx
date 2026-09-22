"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { engineRoom } from "@/engine/participants";
import type { ChairsGameState } from "@/engine/musicalChairs";
import { SIT_SECONDS } from "@/engine/musicalChairs";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function PlayMusicalChairs() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as ChairsGameState | undefined;
  const players = room ? engineRoom(room).players : {};
  const [pending, setPending] = useState(false);
  const [hasSitting, setHasSitting] = useState(false);

  // Reset the local "sat" flag whenever a new sit window opens.
  const windowKey = state ? `${state.phase}-${state.currentRound}` : "idle";
  const [lastKey, setLastKey] = useState(windowKey);
  if (lastKey !== windowKey) {
    setLastKey(windowKey);
    setHasSitting(false);
  }

  if (!state || !player) return null;
  const chairs = Math.max(0, state.survivors.length - 1);
  const iAmOut = state.eliminatedPlayerIds.includes(player.id);
  const iAmLastStand = state.lastStandId === player.id;

  const sit = async () => {
    if (hasSitting || pending) return;
    vibrate(40);
    setPending(true);
    try {
      await submitAction({ type: "sit" });
      setHasSitting(true);
    } catch {
      // Failed flush: let the player try again.
    } finally {
      setPending(false);
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="flex flex-1 flex-col items-center px-4 py-6 text-center">
        {state.phase === "briefing" && (
          <>
            <p className="mb-3 text-6xl" aria-hidden="true">🪑</p>
            <h1 className="text-2xl font-black text-white">準備坐椅子！</h1>
            <p className="mt-2 text-sm text-white/60">
              本回合 {chairs} 把椅子，比人少 1 把。音樂一停立刻坐下！
            </p>
          </>
        )}

        {state.phase === "music" && (
          <>
            <p className="mb-3 text-6xl animate-bounce" aria-hidden="true">🎶</p>
            <h1 className="text-2xl font-black text-white">音樂進行中…</h1>
            <p className="mt-2 text-sm text-white/60">盯緊大螢幕，節拍越來越快，停了就馬上坐下！</p>
            <div className="mt-6 flex gap-2" aria-hidden="true">
              {Array.from({ length: Math.min(8, chairs) }, (_, i) => (
                <span key={i} className="animate-pulse text-3xl" style={{ animationDelay: `${i * 120}ms` }}>
                  🪑
                </span>
              ))}
            </div>
          </>
        )}

        {state.phase === "sit" && (
          <>
            <h1 className="text-3xl font-black text-amber-300">音樂停了！</h1>
            <p className="mt-1 text-sm text-white/70">快坐下，點得最慢的人出局！</p>
            <button
              type="button"
              onClick={() => void sit()}
              disabled={hasSitting || pending}
              className={cn(
                "mt-8 flex h-44 w-44 items-center justify-center rounded-full border-4 text-3xl font-black transition-all active:scale-90",
                hasSitting
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                  : "border-amber-300 bg-amber-400/90 text-black shadow-[0_0_40px_rgba(251,191,36,0.5)] animate-pulse",
              )}
            >
              {hasSitting ? "✓ 已坐下" : "坐下！"}
            </button>
            <div className="mt-6">
              <RoundTimer timeLeft={state.timeLeft} total={SIT_SECONDS} endLabel="沒有椅子！" compact />
            </div>
          </>
        )}

        {state.phase === "round_reveal" && state.roundEliminatedId && (
          <>
            {state.roundEliminatedId === player.id ? (
              <>
                <p className="mb-2 text-6xl" aria-hidden="true">💀</p>
                <h1 className="text-2xl font-black text-red-400">你站着出局了！</h1>
                <p className="mt-2 text-sm text-white/60">分數保留，繼續觀戰下一回合。</p>
              </>
            ) : (
              <>
                <p className="mb-2 text-6xl" aria-hidden="true">🎉</p>
                <h1 className="text-2xl font-black text-emerald-300">你坐到了椅子！+10 分</h1>
                <p className="mt-2 text-sm text-white/60">
                  {players[state.roundEliminatedId]?.nickname} 這回合站着…
                </p>
              </>
            )}
          </>
        )}

        {state.phase === "result" && (
          <>
            <p className="mb-2 text-6xl" aria-hidden="true">{iAmLastStand ? "👑" : "🪑"}</p>
            <h1 className="text-2xl font-black text-white">
              {iAmLastStand ? "你就是音樂椅之王！" : `${players[state.lastStandId ?? ""]?.nickname ?? "倖存者"} 是音樂椅之王`}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              {iAmOut ? "你的最終分數見大螢幕。" : "最終分數見大螢幕！"}
            </p>
          </>
        )}
      </div>
    </PlayShell>
  );
}
