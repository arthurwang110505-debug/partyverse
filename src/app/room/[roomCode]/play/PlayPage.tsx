"use client";

import { useRoom } from "@/providers/RoomContext";
import { RoomGate } from "../RoomGate";
import PlayClient from "./PlayClient";
import PlayGameView from "./PlayGameView";

interface Props {
  roomCode: string;
}

export default function PlayPage({ roomCode }: Props) {
  return (
    <RoomGate roomCode={roomCode}>
      <PlayRoomBody roomCode={roomCode} />
    </RoomGate>
  );
}

/** Rendered only once the gate has confirmed we are a player in a live room. */
function PlayRoomBody({ roomCode }: Props) {
  const { room } = useRoom();
  if (room?.status === "PLAYING") return <PlayGameView />;
  return <PlayClient roomCode={roomCode} />;
}
