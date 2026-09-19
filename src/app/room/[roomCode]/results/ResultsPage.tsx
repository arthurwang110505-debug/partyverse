"use client";

import { useRoom } from "@/providers/RoomContext";
import ResultsClient from "./ResultsClient";
import RoomLoading from "@/app/RoomLoading";

interface Props {
  roomCode: string;
}

export default function ResultsPage({ roomCode }: Props) {
  const { room, loading } = useRoom();

  if (loading || !room) {
    return <RoomLoading label="結算中" />;
  }

  return <ResultsClient roomCode={roomCode} />;
}
