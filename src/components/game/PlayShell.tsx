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
      className="flex min-h-[100dvh] flex-col bg-ink text-white relative"
      style={{ "--game-accent": game?.color, "--game-gradient": game?.gradient } as CSSProperties}
    >
      <FloatingReactions />

      <div className="mx-auto w-full max-w-md px-4 pt-4 pt-safe relative z-10">
        <div className="glass flex items-center justify-between gap-2 rounded-2xl border border-white/10 px-3.5 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-xl" aria-hidden="true">
              {player?.avatar}
            </span>
            <span className="flex items-center gap-1 truncate text-sm font-semibold">
              {player?.nickname}
              {player?.isHost && <Crown className="h-3 w-3 shrink-0 text-yellow-400" aria-label="房主" />}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-white/50">
            {round && <span className="tabular-nums font-medium text-white/70">{round}</span>}
            {game && (
              <span aria-hidden="true" title={game.name}>
                {game.icon}
              </span>
            )}
            <span className="font-bold tracking-widest text-white/70">房 {room?.id}</span>
          </span>
        </div>
      </div>

      <div className={cn("mx-auto w-full max-w-md flex-1 px-4 pb-28 relative z-10", className)}>{children}</div>

      {/* Bottom dock — sits above the iPhone home indicator thanks to dock-safe. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 px-4 dock-safe">
        <p className="pointer-events-auto glass rounded-full border border-white/10 px-4 py-2 text-sm font-medium tabular-nums shadow-lg">
          得分：<span className="font-bold text-white">{score}</span>
        </p>
        <MuteToggle className="pointer-events-auto shadow-lg" />
      </div>
    </main>
  );
}
