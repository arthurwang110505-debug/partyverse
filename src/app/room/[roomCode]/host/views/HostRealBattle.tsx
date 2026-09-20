"use client";

import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { BattleGameState } from "@/engine/realBattle";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";

export default function HostRealBattle() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as BattleGameState | undefined;
  const players = room?.players ?? {};

  if (!state) return null;

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");

  return (
    <HostShell>
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-4">
          <p className="mb-1 text-sm font-semibold text-orange-400">大亂鬥 ⚔️ · 即時手機手把對決</p>
          <h1 className="text-2xl font-black text-white md:text-4xl">搶奪金幣與星星！</h1>
        </header>

        {/* Arena Stage */}
        <div
          className="relative mx-auto my-4 aspect-square w-full max-w-xl overflow-hidden rounded-3xl border-2 border-orange-500/40 bg-slate-950 shadow-2xl"
          role="img"
          aria-label="大亂鬥競技場"
        >
          {/* Arena Items */}
          {state.items.map((item) => (
            <div
              key={item.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 animate-pulse text-2xl"
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              aria-hidden="true"
            >
              {item.type === "star" ? "⭐" : "🪙"}
            </div>
          ))}

          {/* Players */}
          {Object.entries(state.positions).map(([id, pos]) => {
            const p = players[id];
            return (
              <div
                key={id}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-100"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <div className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" aria-hidden="true">
                  {p?.avatar ?? "👾"}
                </div>
                <span className="mt-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {p?.nickname} ({state.currentScores?.[id] ?? 0})
                </span>
              </div>
            );
          })}

          {state.phase === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <span className="animate-bounce text-8xl font-black text-yellow-400" role="status">
                {state.timeLeft}
              </span>
            </div>
          )}

          {state.phase === "battle" && (
            <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/60 px-4 py-2">
              <span className="text-2xl font-black tabular-nums text-orange-400" aria-hidden="true">
                {state.timeLeft} 秒
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <Button variant="ghost" size="md" onClick={() => endRound().catch(fail)}>
            重開
          </Button>
          <Button variant="danger" size="md" onClick={() => endGame().catch(fail)}>
            結算
          </Button>
        </div>
      </div>
    </HostShell>
  );
}
