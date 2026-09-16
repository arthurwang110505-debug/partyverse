"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoom, usePlayer } from "@/providers/RoomContext";
import PlayClient from "./PlayClient";
import PlayGameView from "./PlayGameView";

interface Props {
  roomCode: string;
}

export default function PlayPage({ roomCode }: Props) {
  const router = useRouter();
  const { room, player } = useRoom();

  useEffect(() => {
    if (!player) {
      router.push(`/join/${roomCode}`);
    }
  }, [player, roomCode, router]);

  if (!room || !player) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="text-white/50 animate-pulse">Connecting...</div>
      </div>
    );
  }

  if (room.status === "PLAYING") return <PlayGameView />;
  if (room.status === "RESULTS") {
    router.push(`/room/${roomCode}/results`);
    return null;
  }

  return <PlayClient roomCode={roomCode} />;
}
