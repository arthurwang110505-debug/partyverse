"use client";

import { useRoom } from "@/providers/RoomContext";
import { RoomGate } from "../RoomGate";
import HostLobbyClient from "./HostLobbyClient";
import HostGameView from "./HostGameView";

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
  const { room } = useRoom();
  if (room?.status === "PLAYING") return <HostGameView />;
  return <HostLobbyClient roomCode={roomCode} />;
}
