"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoom, usePlayer } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { ArrowLeft, Crown, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  roomCode: string;
}

export default function PlayClient({ roomCode }: Props) {
  const router = useRouter();
  const { room, player } = useRoom();
  const currentPlayer = usePlayer();

  useEffect(() => {
    if (!currentPlayer) router.push(`/join/${roomCode}`);
  }, [currentPlayer, roomCode, router]);

  const game = GAMES.find((g) => g.id === room?.gameId);
  const isHost = currentPlayer?.isHost || false;

  return (
    <div className="min-h-screen bg-[#050508] text-white p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/join" className="p-2 rounded-xl glass hover:bg-white/10 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="text-center">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Room</div>
            <div className="font-bold text-xl tracking-widest">{roomCode}</div>
          </div>
          <div className="flex items-center gap-1 text-emerald-400 text-sm">
            <Wifi className="w-4 h-4" />
            <span>{room ? Object.keys(room.players).length : 0}</span>
          </div>
        </div>

        {game && (
          <div className="glass-card rounded-2xl p-6 mb-6 text-center">
            <div className="text-5xl mb-3">{game.icon}</div>
            <h1 className="font-bold text-2xl mb-1">{game.name}</h1>
            <p className="text-white/40 text-sm">{game.nameEn}</p>
          </div>
        )}

        {currentPlayer && (
          <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-3 border border-white/10">
            <span className="text-3xl">{currentPlayer.avatar}</span>
            <div className="flex-1">
              <div className="font-semibold flex items-center gap-2">{currentPlayer.nickname}{currentPlayer.isHost && <Crown className="w-4 h-4 text-yellow-400" />}</div>
              <div className="text-xs text-white/40">{currentPlayer.isHost ? "Host" : "Player"}</div>
            </div>
            <div className={cn("w-2 h-2 rounded-full", currentPlayer.isConnected ? "bg-emerald-400" : "bg-red-500")} />
          </div>
        )}

        <div className="text-center py-12">
          {room?.status === "LOBBY" ? (
            <>
              <div className="text-5xl mb-4">⏳</div>
              <h2 className="font-bold text-2xl mb-2">Waiting for Host</h2>
              <p className="text-white/40 text-sm">The host will start the game soon</p>
            </>
          ) : room?.status === "PLAYING" ? (
            <div className="text-emerald-400 text-xl font-bold animate-pulse">GAME IN PROGRESS</div>
          ) : (
            <div className="text-white/30 py-8">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}
