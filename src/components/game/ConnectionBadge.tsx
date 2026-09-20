"use client";

import { useRoom } from "@/providers/RoomContext";
import { Wifi, WifiOff, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionBadgeProps {
  className?: string;
}

export function ConnectionBadge({ className }: ConnectionBadgeProps) {
  const { connectionStatus, isLocalMode } = useRoom();

  if (isLocalMode || connectionStatus === "local") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300",
          className,
        )}
      >
        <Zap className="h-3 w-3 text-cyan-400" aria-hidden="true" />
        本地展示模式
      </span>
    );
  }

  if (connectionStatus === "connected") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300",
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
        即時雲端連線
      </span>
    );
  }

  if (connectionStatus === "reconnecting") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 animate-pulse",
          className,
        )}
      >
        <Wifi className="h-3 w-3 text-amber-400 animate-spin" aria-hidden="true" />
        重新連線中…
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300",
        className,
      )}
    >
      <WifiOff className="h-3 w-3 text-red-400" aria-hidden="true" />
      連線中斷
    </span>
  );
}
