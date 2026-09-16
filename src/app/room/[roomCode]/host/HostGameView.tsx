"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { BombEngine, type BombGameState } from "@/engine/bombCountdown";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { ref, onValue, off } from "firebase/database";

export default function HostGameView() {
  const params = useParams();
  const router = useRouter();
  const { room } = useRoom();
  const roomCode = params.roomCode as string;

  const [displayState, setDisplayState] = useState<BombGameState | null>(null);

  useEffect(() => {
    if (!db || !roomCode) return;
    const unsub = onValue(ref(db, `rooms/${roomCode}`), (snap) => {
      const data = snap.val();
      if (data?.gameState) setDisplayState(data.gameState as BombGameState);
    });
    return () => off(ref(db, `rooms/${roomCode}`), "value", unsub);
  }, [roomCode]);

  useEffect(() => {
    if (!displayState || (displayState.phase !== "passing" && displayState.phase !== "challenge")) return;
    const timer = setInterval(() => {
      if (!room) return;
      const newState = BombEngine.updateGameState(room);
      setDisplayState(newState as BombGameState);
    }, 1000);
    return () => clearInterval(timer);
  }, [displayState?.phase, room]);

  useEffect(() => {
    if (displayState?.phase === "result") {
      const timer = setTimeout(() => router.push(`/room/${roomCode}/results`), 3000);
      return () => clearTimeout(timer);
    }
  }, [displayState?.phase, roomCode, router]);

  const game = GAMES.find((g) => g.id === room?.gameId);
  const players = room?.players || {};
  const activePlayers = Object.entries(players).filter(([id]) => !displayState?.eliminatedPlayers.includes(id));
  const eliminatedPlayers = Object.entries(players).filter(([id]) => displayState?.eliminatedPlayers.includes(id));

  if (!room) return <div className="min-h-screen bg-[#050508] flex items-center justify-center"><div className="text-white/50">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-[#050508] text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-sm text-white/40 mb-2">{game?.icon} {game?.name}</div>
          <div className="font-bold text-xl">Round {displayState?.currentRound || 1}</div>
        </div>

        <div className="flex justify-center mb-8">
          <div className={cn(
            "w-40 h-40 rounded-full flex items-center justify-center text-7xl transition-all duration-300",
            displayState?.phase === "exploded" ? "bg-red-500" :
            displayState?.bombTimeLeft && displayState.bombTimeLeft <= 3 ? "bg-red-500 animate-pulse" :
            displayState?.bombTimeLeft && displayState.bombTimeLeft <= 5 ? "bg-orange-500" : "bg-white/10"
          )} style={{ boxShadow: displayState?.bombTimeLeft && displayState.bombTimeLeft <= 3 ? "0 0 60px rgba(239,68,68,0.6)" : "none" }}>
            {displayState?.phase === "exploded" ? "💥" : "💣"}
          </div>
        </div>

        {displayState && displayState.bombTimeLeft > 0 && (
          <div className="text-center mb-6">
            <div className="font-bold text-6xl" style={{ color: displayState.bombTimeLeft <= 3 ? "#ef4444" : "#ffe600" }}>
              {displayState.bombTimeLeft}
            </div>
          </div>
        )}

        {displayState?.bombHolderId && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl glass">
              <span className="text-4xl">{players[displayState.bombHolderId]?.avatar || "🎮"}</span>
              <div className="text-left">
                <div className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Bomb Holder</div>
                <div className="font-bold text-xl">{players[displayState.bombHolderId]?.nickname || "Unknown"}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {activePlayers.map(([id, p]) => (
            <div key={id} className={cn("p-3 rounded-xl text-center transition-all", id === displayState?.bombHolderId ? "bg-violet-500/20 border border-violet-500/40" : "bg-white/5 border border-white/5")}>
              <div className="text-2xl mb-1">{p.avatar}</div>
              <div className="text-sm font-medium truncate">{p.nickname}</div>
              <div className="text-xs text-white/40">{displayState?.currentScores?.[id] || 0} pts</div>
            </div>
          ))}
          {eliminatedPlayers.map(([id, p]) => (
            <div key={id} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center opacity-40">
              <div className="text-2xl mb-1">💀</div>
              <div className="text-sm font-medium truncate">{p.nickname}</div>
              <div className="text-xs text-red-400">OUT</div>
            </div>
          ))}
        </div>

        {displayState?.phase === "result" && (
          <div className="fixed inset-0 bg-[#050508]/95 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="text-8xl mb-4">🏆</div>
              <h1 className="font-bold text-5xl mb-4 bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">GAME OVER</h1>
              <p className="text-white/40 text-lg">Redirecting to results...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
