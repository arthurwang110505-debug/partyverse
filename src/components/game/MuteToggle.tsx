"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { initMuted, setMuted } from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * Sound on/off. Every phone and the TV get one — a party game without a mute
 * button is one bad round away from being silenced at the system level.
 * Initialised after mount so the server render and first paint agree.
 */
export function MuteToggle({ className }: { className?: string }) {
  const [muted, setMutedState] = useState(false);

  useEffect(() => setMutedState(initMuted()), []);

  return (
    <button
      type="button"
      onClick={() => setMutedState(setMuted(!muted))}
      aria-pressed={muted}
      aria-label={muted ? "開啟音效" : "關閉音效"}
      title={muted ? "開啟音效" : "關閉音效"}
      className={cn(
        "glass inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition-all hover:bg-white/10 hover:text-white",
        className,
      )}
    >
      {muted ? (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
