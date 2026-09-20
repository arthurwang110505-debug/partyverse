"use client";

import type { CSSProperties, ReactNode } from "react";
import { Crown } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { MuteToggle } from "@/components/game/MuteToggle";
import { FloatingReactions } from "@/components/game/FloatingReactions";
import { cn } from "@/lib/utils";

interface PlayShellProps {
  children: ReactNode;
  className?: string;
  /** A short round indicator shown in the top bar, e.g. "第 2 / 5 回合". */
  round?: string;
}

/**
 * The phone-controller chrome shared by every game.
 *
 * Before this component each of the 9 game views hand-rolled its own header
 * and nothing showed who you are, your score, or the room you're in. The shell
 * provides:
 *
 *  - top bar: your avatar + nickname, the game, and the room code
 *  - bottom dock (safe-area aware): live score pill + sound toggle
 *  - `--game-accent` / `--game-gradient` CSS variables, so any `variant="accent"`
 *    button inside automatically matches the current game's color
 *  - `100dvh` height so nothing hides under mobile Safari's collapsing URL bar
 */
export function PlayShell({ children, className, round }: PlayShellProps) {
  const { room, player } = useRoom();
  const game = GAMES.find((g) => g.id === room?.gameId);
  const score =
    (room?.gameState as { currentScores?: Record<string, number> } | undefined)?.currentScores?.[player?.id ?? ""] ??
    0;

  return (
    <main
      className="flex min-h-[100dvh] flex-col bg-[#0b0c14] text-white relative overflow-hidden before:pointer-events-none before:fixed before:inset-y-0 before:left-0 before:w-2 before:bg-gradient-to-r before:from-cyan-500/30 before:to-transparent before:z-50 after:pointer-events-none after:fixed after:inset-y-0 after:right-0 after:w-2 after:bg-gradient-to-l after:from-rose-500/30 after:to-transparent after:z-50"
      style={{ "--game-accent": game?.color, "--game-gradient": game?.gradient } as CSSProperties}
    >
      <FloatingReactions />

      <div className="relative z-10 mx-auto w-full max-w-md px-safe pt-4 pt-safe">
        <div className="glass flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-white/10 px-3 py-2.5 shadow-lg shadow-black/40 ring-1 ring-white/5 sm:px-3.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-lg ring-1 ring-cyan-500/30" aria-hidden="true">
              {player?.avatar}
            </span>
            <span className="flex min-w-0 items-center gap-1 truncate text-sm font-bold text-white">
              {player?.nickname}
              {player?.isHost && <Crown className="h-3.5 w-3.5 shrink-0 text-yellow-400" aria-label="房主" />}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs">
            {round && <span className="tabular-nums font-bold text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded-full border border-cyan-500/30">{round}</span>}
            {game && (
              <span aria-hidden="true" title={game.name}>
                {game.icon}
              </span>
            )}
            <span className="font-mono font-bold tracking-wider text-rose-300 bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-500/30">
              房 {room?.id}
            </span>
          </span>
        </div>
      </div>

      <div className={cn("relative z-10 mx-auto w-full max-w-md flex-1 px-safe pb-28", className)}>{children}</div>

      {/* Bottom dock — sits above the iPhone home indicator thanks to dock-safe. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 px-safe dock-safe">
        <p className="pointer-events-auto glass rounded-full border border-white/10 px-4 py-2 text-sm font-bold tabular-nums shadow-xl bg-black/60 backdrop-blur-md">
          得分：<span className="font-black text-cyan-300">{score}</span>
        </p>
        <MuteToggle className="pointer-events-auto shadow-lg" />
      </div>
    </main>
  );
}
