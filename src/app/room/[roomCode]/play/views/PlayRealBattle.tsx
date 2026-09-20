"use client";

import { useEffect, useRef } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { BattleGameState } from "@/engine/realBattle";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate } from "@/lib/sound";

/** How fast a held direction repeats, in ms — close to the host's tick rate. */
const REPEAT_MS = 160;

export default function PlayRealBattle() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as BattleGameState | undefined;
  const repeatTimer = useRef<number | null>(null);
  const failedOnce = useRef(false);

  useEffect(() => stopRepeating, []);

  if (!state || !player) return null;

  const stopRepeating = () => {
    if (repeatTimer.current !== null) {
      window.clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  };

  const move = async (dx: number, dy: number) => {
    vibrate(8);
    try {
      await submitAction({ type: "move", dx, dy });
    } catch {
      // Moves fire several times per second — surface the first failure, then
      // stay quiet instead of carpet-bombing the screen with toasts.
      if (!failedOnce.current) {
        failedOnce.current = true;
        toast("操作沒有送出，檢查連線");
        window.setTimeout(() => {
          failedOnce.current = false;
        }, 5000);
      }
    }
  };

  /** Press-and-hold: tap moves once, holding keeps walking. */
  const startRepeating = (dx: number, dy: number) => {
    stopRepeating();
    void move(dx, dy);
    repeatTimer.current = window.setInterval(() => void move(dx, dy), REPEAT_MS);
  };

  const padButtons: Array<{ dx: number; dy: number; glyph: string; label: string }> = [
    { dx: 0, dy: -1, glyph: "▲", label: "向上移動" },
    { dx: -1, dy: 0, glyph: "◀", label: "向左移動" },
    { dx: 1, dy: 0, glyph: "▶", label: "向右移動" },
    { dx: 0, dy: 1, glyph: "▼", label: "向下移動" },
  ];

  const padButtonClass =
    "flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-3xl " +
    "font-black text-white shadow-lg transition-all active:scale-95 active:bg-orange-500 select-none";

  const padHandlers = (dx: number, dy: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      startRepeating(dx, dy);
    },
    onPointerUp: stopRepeating,
    onPointerLeave: stopRepeating,
    onPointerCancel: stopRepeating,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <PlayShell>
      <div className="text-center">
        <header className="mb-4 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-orange-400">
            手機手把 · 大亂鬥 ⚔️
          </span>
          <p className="text-sm text-white/70">按住方向鍵操控角色，搶奪星星與金幣！</p>
        </header>

        {/* touch-none: swiping across the pad shouldn't scroll the page */}
        <div className="flex touch-none flex-col items-center justify-center gap-3 py-6">
          <button
            type="button"
            aria-label={padButtons[0].label}
            className={padButtonClass}
            {...padHandlers(padButtons[0].dx, padButtons[0].dy)}
          >
            <span aria-hidden="true">{padButtons[0].glyph}</span>
          </button>
          <div className="flex gap-4">
            <button
              type="button"
              aria-label={padButtons[1].label}
              className={padButtonClass}
              {...padHandlers(padButtons[1].dx, padButtons[1].dy)}
            >
              <span aria-hidden="true">{padButtons[1].glyph}</span>
            </button>
            <div
              className="h-20 w-20 rounded-2xl border border-white/5 bg-white/5"
              aria-hidden="true"
            />
            <button
              type="button"
              aria-label={padButtons[2].label}
              className={padButtonClass}
              {...padHandlers(padButtons[2].dx, padButtons[2].dy)}
            >
              <span aria-hidden="true">{padButtons[2].glyph}</span>
            </button>
          </div>
          <button
            type="button"
            aria-label={padButtons[3].label}
            className={padButtonClass}
            {...padHandlers(padButtons[3].dx, padButtons[3].dy)}
          >
            <span aria-hidden="true">{padButtons[3].glyph}</span>
          </button>
        </div>

        <p className="text-xs text-white/40">
          {state.phase === "battle" ? `剩餘 ${state.timeLeft} 秒` : "等房主開戰…"}
        </p>
      </div>
    </PlayShell>
  );
}
