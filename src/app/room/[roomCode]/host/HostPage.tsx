"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoom, usePlayer } from "@/providers/RoomContext";
import HostLobbyClient from "./HostLobbyClient";
import HostGameView from "./HostGameView";

interface Props {
  roomCode: string;
}

export default function HostPage({ roomCode }: Props) {
  const router = useRouter();
  const { room, player } = useRoom();

  useEffect(() => {
    if (player && !player.isHost) {
      router.push(`/room/${roomCode}/play`);
    }
  }, [player, roomCode, router]);

  if (!room) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="text-white/50 animate-pulse">Loading room...</div>
      </div>
    );
  }

  if (room.status === "PLAYING") return <HostGameView />;
  if (room.status === "RESULTS") {
    router.push(`/room/${roomCode}/results`);
    return null;
  }

  return <HostLobbyClient roomCode={roomCode} />;
}
