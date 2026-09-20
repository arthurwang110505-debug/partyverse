"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useRoom } from "@/providers/RoomContext";
import { LinkButton } from "@/components/ui/Button";

/**
 * Shared guard for every `/room/...` route.
 *
 * All redirects happen in effects. The previous pages called `router.push()`
 * during render, which React can warn about and double-fire under Strict Mode
 * (`reactStrictMode: true` is on in next.config.js).
 */
export function RoomGate({
  roomCode,
  children,
  /** When true, non-hosts are bounced to the player view. */
  hostOnly = false,
}: {
  roomCode: string;
  children: ReactNode;
  hostOnly?: boolean;
}) {
  const router = useRouter();
  const { room, player, loading, isHost } = useRoom();

  // Not signed into this room at all → send them to the join form.
  useEffect(() => {
    if (!loading && (!player || room?.id !== roomCode)) router.replace(`/join/${roomCode}`);
  }, [loading, player, room?.id, roomCode, router]);

  // In the room, but on the wrong side of it.
  useEffect(() => {
    if (!loading && player && hostOnly && !isHost && player?.role !== "display")
      router.replace(`/room/${roomCode}/play`);
  }, [loading, player, hostOnly, isHost, roomCode, router]);

  // The game ended while they were here.
  useEffect(() => {
    if (room?.status === "RESULTS") router.replace(`/room/${roomCode}/results`);
  }, [room?.status, roomCode, router]);

  if (loading || !room || !player || room.id !== roomCode) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink text-white">
        <p className="animate-pulse text-white/50" role="status">
          連接房間中…
        </p>
        <p className="text-xs text-white/40">如果一直停在這裡，房間可能已經結束了。</p>
        <LinkButton href="/join" variant="ghost" size="sm">
          加入其他房間
        </LinkButton>
      </main>
    );
  }

  if (hostOnly && !isHost && player?.role !== "display") return null;
  if (room.status === "RESULTS") return null;

  return <>{children}</>;
}
