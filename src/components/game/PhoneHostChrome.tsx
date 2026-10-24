"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Gamepad2, MonitorPlay } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { MuteToggle } from "@/components/game/MuteToggle";
import { ConnectionBadge } from "@/components/game/ConnectionBadge";
import { hostIsPlaying, type PhoneHostTab } from "@/lib/hostMode";
import { cn } from "@/lib/utils";

/**
 * `true` while a view is rendered inside the phone-host chrome.
 *
 * `HostShell` and `PlayShell` are written for their own device: the TV shell
 * owns the page and the phone shell owns its own top bar and fixed score dock.
 * Stacked inside the phone-host wrapper those become duplicates, and the dock
 * would sit underneath the stage/controller switch. Views read this flag and
 * drop the pieces the wrapper already provides.
 */
const EmbeddedContext = createContext(false);

export function usePhoneHostEmbedded(): boolean {
  return useContext(EmbeddedContext);
}

/**
 * The phone host's permanent chrome: one slim bar with the room identity and
 * live score, and — when the host also plays — a fixed switch between the
 * shared stage and their own controller.
 *
 * Both "tabs" are the very same host tab: the game clock keeps ticking whether
 * the stage or the controller is visible, so a host never stops the room by
 * looking at their own buttons.
 */
export function PhoneHostChrome({
  tab,
  onTabChange,
  children,
}: {
  tab: PhoneHostTab;
  onTabChange: (tab: PhoneHostTab) => void;
  children: ReactNode;
}) {
  const { room, player } = useRoom();
  const game = GAMES.find((g) => g.id === room?.gameId);
  // A host who chose "我也要一起玩" is a participant and gets the switch. A
  // presenting host only ever sees the stage.
  const canSwitch = hostIsPlaying(room) && player?.role !== "display";
  const score =
    (room?.gameState as { currentScores?: Record<string, number> } | undefined)?.currentScores?.[
      player?.id ?? ""
    ] ?? 0;

  return (
    <EmbeddedContext.Provider value>
      <div className="flex min-h-[100dvh] flex-col bg-ink text-white">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0c14]/95 px-3 pt-safe pb-2 backdrop-blur-md">
          <div className="flex items-center gap-2 pt-2">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span aria-hidden="true" className="text-lg">
                {game?.icon ?? "🎮"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight">{game?.name ?? "PARTYVERSE"}</span>
                <span className="block truncate text-[10px] font-medium tracking-wide text-white/45">
                  手機主持 · 房間 <span className="font-mono font-bold tracking-widest text-white/70">{room?.id}</span>
                </span>
              </span>
            </span>

            {canSwitch && (
              <span
                className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-950/50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-cyan-300"
                aria-label={`我的得分 ${score}`}
              >
                {score} 分
              </span>
            )}
            <ConnectionBadge className="hidden shrink-0 px-2 py-0.5 text-[10px] sm:inline-flex" />
            <MuteToggle className="h-8 w-8 shrink-0" />
          </div>
        </header>

        <div className={cn("flex-1", canSwitch && "pb-[calc(4.75rem+env(safe-area-inset-bottom))]")}>{children}</div>

        {canSwitch && (
          <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0c14]/97 px-3 pt-2 backdrop-blur-md dock-safe"
            aria-label="手機主持分頁"
          >
            <div className="mx-auto flex max-w-md gap-2">
              <button
                type="button"
                aria-pressed={tab === "stage"}
                onClick={() => onTabChange("stage")}
                className={cn(
                  "flex min-h-[52px] flex-1 flex-col items-center justify-center rounded-xl border text-[11px] font-bold transition-colors",
                  tab === "stage"
                    ? "border-transparent bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/55",
                )}
              >
                <MonitorPlay className="mb-0.5 h-4 w-4" aria-hidden="true" />
                主持畫面
              </button>
              <button
                type="button"
                aria-pressed={tab === "controller"}
                onClick={() => onTabChange("controller")}
                className={cn(
                  "flex min-h-[52px] flex-1 flex-col items-center justify-center rounded-xl border text-[11px] font-bold transition-colors",
                  tab === "controller"
                    ? "border-transparent bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/55",
                )}
              >
                <Gamepad2 className="mb-0.5 h-4 w-4" aria-hidden="true" />
                我的手把
              </button>
            </div>
          </nav>
        )}
      </div>
    </EmbeddedContext.Provider>
  );
}
