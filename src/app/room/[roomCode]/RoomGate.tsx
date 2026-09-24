"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import { decideRoomEntry } from "@/lib/roomEntry";
import { LinkButton } from "@/components/ui/Button";

/**
 * Shared guard for every `/room/...` route.
 *
 * All redirects happen in effects. The previous pages called `router.push()`
 * during render, which React can warn about and double-fire under Strict Mode
 * (`reactStrictMode: true` is on in next.config.js).
 *
 * The decision itself lives in `decideRoomEntry` because "no room yet" and "not
 * this room" used to be the same thing here — which sent a host who had just
 * created a room straight to `/join/<code>`.
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
  const { toast } = useToast();
  const { room, player, loading, pendingRoomCode, lostRoomCode, isHost } = useRoom();

  const decision = decideRoomEntry({
    roomCode,
    loading,
    pendingRoomCode,
    lostRoomCode,
    roomId: room?.id ?? null,
    hasPlayer: Boolean(player),
    hostOnly,
    isHost,
    isDisplay: player?.role === "display",
  });
  const finished = decision === "ready" && room?.status === "RESULTS";

  // Not signed into this room at all → send them to the join form.
  useEffect(() => {
    if (decision === "join") router.replace(`/join/${roomCode}`);
  }, [decision, roomCode, router]);

  // The room itself is gone (ended, or removed from another device).
  const announced = useRef("");
  useEffect(() => {
    if (decision !== "home") return;
    if (announced.current !== roomCode) {
      announced.current = roomCode;
      toast("房間已經結束了，帶你回到首頁");
    }
    router.replace("/");
  }, [decision, roomCode, router, toast]);

  // In the room, but on the wrong side of it.
  useEffect(() => {
    if (decision === "play") router.replace(`/room/${roomCode}/play`);
  }, [decision, roomCode, router]);

  // The game ended while they were here.
  useEffect(() => {
    if (finished) router.replace(`/room/${roomCode}/results`);
  }, [finished, roomCode, router]);

  if (decision !== "ready" || finished) {
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

  return <>{children}</>;
}
