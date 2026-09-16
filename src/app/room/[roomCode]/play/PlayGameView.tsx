"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoom, usePlayer } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { BombEngine, type BombChallenge, type BombGameState } from "@/engine/bombCountdown";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { ref, onValue, off, update } from "firebase/database";

export default function PlayGameView() {
  const params = useParams();
  const router = useRouter();
  const { room, player: currentPlayer } = useRoom();
  const roomCode = params.roomCode as string;

  const [gameState, setGameState] = useState<BombGameState | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!db || !roomCode || !currentPlayer) return;

    const unsub = onValue(ref(db, `rooms/${roomCode}`), (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      const state = data.gameState as BombGameState;
      setGameState(state || null);

      if (state?.phase === "result") {
        setTimeout(() => router.push(`/room/${roomCode}/results`), 3000);
      }
    });

    return () => off(ref(db, `rooms/${roomCode}`), "value", unsub);
  }, [roomCode, currentPlayer, router]);

  useEffect(() => {
    if (!gameState || (gameState.phase !== "passing" && gameState.phase !== "challenge")) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return gameState.bombTimeLeft;
        return prev - 1;
      });
    }, 1000);
    setCountdown(gameState.bombTimeLeft || 0);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.bombTimeLeft, gameState?.phase]);

  const game = GAMES.find((g) => g.id === room?.gameId);
  const isMyTurn = gameState?.bombHolderId === currentPlayer?.id;
  const isEliminated = gameState?.eliminatedPlayers.includes(currentPlayer?.id || "");

  if (!room || !currentPlayer) {
    return <div className="min-h-screen bg-[#050508] flex items-center justify-center"><div className="text-white/50">Connecting...</div></div>;
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <div className="max-w-md mx-auto p-4 pt-8">
        <div className="text-center mb-6">
          <div className="text-sm text-white/40 mb-1">{game?.icon} {game?.name}</div>
          <div className="font-bold text-sm">Room {roomCode}</div>
        </div>

        {gameState && (gameState.phase === "passing" || gameState.phase === "challenge") && (
          <div className="flex justify-center mb-6">
            <div
              className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold transition-all duration-300",
                countdown <= 3 ? "bg-red-500" : countdown <= 5 ? "bg-orange-500" : "bg-white/10"
              )}
              style={{ boxShadow: countdown <= 3 ? "0 0 60px rgba(239,68,68,0.6)" : "none" }}
            >
              {countdown}
            </div>
          </div>
        )}

        {isEliminated ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💀</div>
            <h2 className="font-bold text-2xl text-red-400 mb-2">ELIMINATED</h2>
            <p className="text-white/40 text-sm">The bomb got you</p>
          </div>
        ) : gameState?.phase === "result" ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="font-bold text-2xl bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">GAME OVER</h2>
            <p className="text-white/40 text-sm mt-2">Check results</p>
          </div>
        ) : !isMyTurn && gameState?.phase === "challenge" ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-white/40 text-sm">Waiting for your turn</p>
          </div>
        ) : isMyTurn && gameState?.phase === "challenge" && gameState.challenge ? (
          <div>
            <div className="text-center mb-4">
              <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Your Turn</div>
              <div className="font-bold text-lg">{gameState.challenge.question}</div>
            </div>
            <div className="space-y-2">
              {gameState.challenge.options?.map((opt) => (
                <button key={opt} className="w-full py-3.5 rounded-xl font-medium text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/80">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : gameState?.phase === "waiting" ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💣</div>
            <p className="text-white/40 text-sm">Waiting for host to start</p>
          </div>
        ) : (
          <div className="text-center py-12 text-white/30 text-sm">Loading...</div>
        )}

        {gameState && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-full border border-white/10">
            <span className="text-sm font-medium">Score: {gameState.currentScores?.[currentPlayer.id] || 0}</span>
          </div>
        )}
      </div>
    </div>
  );
}
