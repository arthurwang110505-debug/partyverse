"use client";

import { useRoom } from "@/providers/RoomContext";
import { RoomGate } from "../RoomGate";
import HostLobbyClient from "./HostLobbyClient";
import HostGameView from "./HostGameView";
import PlayGameView from "../play/PlayGameView";

interface Props {
  roomCode: string;
}

export default function HostPage({ roomCode }: Props) {
  return (
    <RoomGate roomCode={roomCode} hostOnly>
      <HostRoomBody roomCode={roomCode} />
    </RoomGate>
  );
}

/** Rendered only once the gate has confirmed we are the host of a live room. */
function HostRoomBody({ roomCode }: Props) {
  const { room, player } = useRoom();
  if (room?.status === "PLAYING") return player?.role === "display" ? <HostGameView /> : <PlayGameView />;
  return <HostLobbyClient roomCode={roomCode} />;
}
