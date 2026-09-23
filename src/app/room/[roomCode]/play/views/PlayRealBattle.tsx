"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { BattleGameState } from "@/engine/realBattle";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate } from "@/lib/sound";

/**
 * Held-direction repeat interval. Each move is a whole-room transaction, so
 * this caps the write rate per player (~5/sec) instead of carpet-bombing the
 * room store while a pad button is held.
 */
const REPEAT_MS = 200;

export default function PlayRealBattle() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as BattleGameState | undefined;
  const repeatTimer = useRef<number | null>(null);
  const failedOnce = useRef(false);

  const stopRepeating = useCallback(() => {
    if (repeatTimer.current !== null) {
      window.clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  }, []);
  useEffect(() => stopRepeating, [stopRepeating]);
  useEffect(() => {
    if (state?.phase !== "battle") stopRepeating();
  }, [state?.phase, stopRepeating]);
  if (!state || !player) return null;

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
    if (state.phase !== "battle") return;
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
    "flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-cyan-400/40 bg-cyan-950/40 text-3xl " +
    "font-black text-cyan-200 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 active:bg-cyan-500 active:text-black select-none cursor-pointer";

  const padHandlers = (dx: number, dy: number) => ({
    disabled: state.phase !== "battle",
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0) void move(dx, dy);
    },
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
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-rose-400/50 bg-rose-950/40 px-3 py-1 text-xs font-black uppercase tracking-wider text-rose-300 shadow-sm shadow-rose-500/20">
            ⚔️ 實體手機手把 · 大亂鬥
          </span>
          <p className="mt-2 text-sm text-white/70">按住方向鍵操控角色，搶奪星星與金幣！撞開對手更快搶到！</p>
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
              className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-rose-500/40 bg-rose-950/40 text-xs font-black tracking-widest text-rose-400 shadow-md shadow-rose-500/20"
              aria-hidden="true"
            >
              JOY
            </div>
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

        <p className="font-mono text-sm font-bold text-cyan-300">
          {state.phase === "battle" ? `⏳ 剩餘 ${state.timeLeft} 秒` : "等房主開戰…"}
        </p>
      </div>
    </PlayShell>
  );
}
