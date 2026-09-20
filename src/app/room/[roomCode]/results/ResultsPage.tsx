"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/providers/RoomContext";
import ResultsClient from "./ResultsClient";
import RoomLoading from "@/app/RoomLoading";

export default function ResultsPage({ roomCode }: { roomCode: string }) {
  const { room, player, isHost, loading } = useRoom();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!room || !player || room.id !== roomCode) router.replace(`/join/${roomCode}`);
    else if (room.status !== "RESULTS")
      router.replace(`/room/${roomCode}/${isHost || player.role === "display" ? "host" : "play"}`);
  }, [room, player, isHost, loading, roomCode, router]);
  if (loading || !room || !player || room.id !== roomCode || room.status !== "RESULTS")
    return <RoomLoading label="連接房間中" />;
  return <ResultsClient roomCode={roomCode} />;
}
