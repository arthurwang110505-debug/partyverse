"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/providers/RoomContext";
import { decideRoomEntry } from "@/lib/roomEntry";
import ResultsClient from "./ResultsClient";
import RoomLoading from "@/app/RoomLoading";

export default function ResultsPage({ roomCode }: { roomCode: string }) {
  const { room, player, isHost, loading, pendingRoomCode, lostRoomCode } = useRoom();
  const router = useRouter();
  const decision = decideRoomEntry({
    roomCode,
    loading,
    pendingRoomCode,
    lostRoomCode,
    roomId: room?.id ?? null,
    hasPlayer: Boolean(player),
    hostOnly: false,
    isHost,
    isDisplay: player?.role === "display",
  });

  useEffect(() => {
    if (decision === "wait") return;
    if (decision === "home") router.replace("/");
    else if (decision === "join") router.replace(`/join/${roomCode}`);
    else if (room && room.status !== "RESULTS")
      router.replace(`/room/${roomCode}/${isHost || player?.role === "display" ? "host" : "play"}`);
  }, [decision, room, player, isHost, roomCode, router]);

  if (decision !== "ready" || room?.status !== "RESULTS") return <RoomLoading label="連接房間中" />;
  return <ResultsClient roomCode={roomCode} />;
}
