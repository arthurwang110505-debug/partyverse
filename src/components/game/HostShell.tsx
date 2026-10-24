"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { MuteToggle } from "@/components/game/MuteToggle";
import { ConnectionBadge } from "@/components/game/ConnectionBadge";
import { FloatingReactions } from "@/components/game/FloatingReactions";
import { sfx } from "@/lib/sound";
import { GameplayFeedback } from "./GameplayFeedback";
import { usePhoneHostEmbedded } from "./PhoneHostChrome";
import { cn } from "@/lib/utils";

interface HostShellProps {
  children: ReactNode;
  className?: string;
  /** Where the top bar's max width stops; content views manage their own width. */
  wide?: boolean;
}

/**
 * The TV big-screen chrome shared by every game.
 *
 * Provides a slim identity bar (game + room code + sound toggle), the
 * `--game-accent` CSS variables for accent buttons, and — critically — the
 * audio bed that previously existed for exactly 1 of 10 games:
 *  - a soft tick for each of the final 5 seconds of any countdown
 *  - a success sting on every phase change (vote close, reveal, round start)
 *
 * Game-specific sounds (bomb explosions, join chimes) stay in their views.
 */
export function HostShell({ children, className, wide = true }: HostShellProps) {
  const { room } = useRoom();
  const game = GAMES.find((g) => g.id === room?.gameId);
  // Inside the phone-host wrapper the wrapper owns the top bar, the score and
  // the safe areas; this shell only supplies the stage body.
  const embedded = usePhoneHostEmbedded();

  // Engines all expose `timeLeft`; the bomb engine calls it `bombTimeLeft`.
  const state = room?.gameState as { phase?: string; timeLeft?: number; bombTimeLeft?: number } | undefined;
  const timeLeft = state?.timeLeft ?? state?.bombTimeLeft;
  const phase = state?.phase;

  const lastTick = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (timeLeft === undefined || timeLeft === lastTick.current) return;
    lastTick.current = timeLeft;
    if (timeLeft > 0 && timeLeft <= 5) sfx.playTick(620, 0.05);
  }, [timeLeft]);

  const lastPhase = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (phase === undefined) return;
    if (lastPhase.current !== undefined && phase !== lastPhase.current) {
      if (phase === "exploded") sfx.playBoom();
      else if (phase === "result") sfx.playFanfare();
      else if (["reveal", "round_reveal", "ejected"].includes(phase)) sfx.playSuccess();
    }
    lastPhase.current = phase;
  }, [phase]);

  return (
    <main
      className={cn(
        "bg-ink text-white relative",
        embedded ? "phone-stage min-h-0 px-3 py-3" : "min-h-[100dvh] p-4 md:p-8",
      )}
      style={{ "--game-accent": game?.color, "--game-gradient": game?.gradient } as CSSProperties}
    >
      <FloatingReactions />

      {!embedded && (
        <div
          className={cn(
            "mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 relative z-10",
            wide ? "max-w-5xl" : "max-w-3xl",
          )}
        >
          <p className="glass inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-sm text-white/60">
            {game && <span aria-hidden="true">{game.icon}</span>}
            <span className="font-medium text-white/80">{game?.name ?? "PARTYVERSE"}</span>
            <span className="text-white/25" aria-hidden="true">
              ·
            </span>
            <span className="font-bold tracking-widest text-white/70">房間 {room?.id}</span>
          </p>

          <div className="flex items-center gap-2">
            <ConnectionBadge className="hidden sm:inline-flex text-[11px] px-2.5 py-0.5" />
            <MuteToggle />
          </div>
        </div>
      )}
      <div className={cn("relative z-10", className)}>
        <GameplayFeedback />
        {children}
      </div>
    </main>
  );
}
