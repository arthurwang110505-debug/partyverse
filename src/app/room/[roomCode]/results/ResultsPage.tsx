"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/providers/RoomContext";
import ResultsClient from "./ResultsClient";
import { db } from "@/lib/firebase";
import { ref, onValue, off } from "firebase/database";

interface Props {
  roomCode: string;
}

export default function ResultsPage({ roomCode }: Props) {
  const router = useRouter();
  const { room } = useRoom();

  useEffect(() => {
    if (!db || !roomCode) return;
    const unsub = onValue(ref(db, `rooms/${roomCode}`), () => {});
    return () => off(ref(db, `rooms/${roomCode}`), "value", unsub);
  }, [roomCode]);

  if (!room) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="text-white/50 animate-pulse">Loading...</div>
      </div>
    );
  }

  return <ResultsClient roomCode={roomCode} />;
}
