"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trophy, ArrowLeft, RotateCcw, Gamepad2, Home } from "lucide-react";
import Link from "next/link";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { cn } from "@/lib/utils";

interface Props {
  roomCode: string;
}

const ACHIEVEMENTS = [
  { id: "fastest", name: "Fastest", icon: "⚡", desc: "Quickest response" },
  { id: "luckiest", name: "Luckiest", icon: "🍀", desc: "Lucky survivor" },
  { id: "chaotic", name: "Most Chaotic", icon: "🌪️", desc: "Pure chaos agent" },
  { id: "bluffer", name: "Best Bluffer", icon: "🎭", desc: "Master of deception" },
  { id: "legend", name: "Legend", icon: "👑", desc: "True champion" },
  { id: "novice", name: "Novice", icon: "🌱", desc: "Just getting started" },
];

export default function ResultsClient({ roomCode }: Props) {
  const router = useRouter();
  const { room, player: currentPlayer } = useRoom();
  const [sortedPlayers, setSortedPlayers] = useState<Array<{ id: string; player: (typeof currentPlayer) & { id: string } }> | null>(null);

  useEffect(() => {
    if (!room?.players) return;
    const entries = Object.entries(room.players).map(([id, p]) => ({
      id,
      player: p,
      score: (room.gameState as Record<string, unknown>)?.[`score_${id}`] as number || 0,
    }));
    const gs = room.gameState as Record<string, unknown>;
    const scores = (gs.currentScores as Record<string, number>) || {};
    const sorted = entries.sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
    setSortedPlayers(sorted);
  }, [room]);

  const game = GAMES.find((g) => g.id === room?.gameId);
  const winner = sortedPlayers?.[0];

  return (
    <div className="min-h-screen bg-[#050508] text-white p-4">
      <div className="max-w-lg mx-auto pt-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏆</div>
          <h1 className="font-bold text-3xl mb-2">Results</h1>
          {game && <p className="text-white/40 text-sm">{game.icon} {game.name}</p>}
        </div>

        {/* Podium */}
        {sortedPlayers && sortedPlayers.length > 0 && (
          <div className="flex items-end justify-center gap-3 mb-8 h-48">
            {sortedPlayers[1] && (
              <div className="flex flex-col items-center">
                <div className="text-2xl mb-1">🥈</div>
                <div className="text-2xl mb-1">{sortedPlayers[1].player?.avatar}</div>
                <div className="text-xs font-medium text-center max-w-[80px] truncate">{sortedPlayers[1].player?.nickname}</div>
                <div className="text-cyan-400 text-sm font-bold">{sortedPlayers[1].score} pts</div>
                <div className="w-16 h-12 bg-white/5 rounded-t-lg flex items-end justify-center pb-2 font-bold text-lg border border-white/5">2</div>
              </div>
            )}
            {winner && (
              <div className="flex flex-col items-center">
                <div className="text-3xl mb-1">🥇</div>
                <div className="text-3xl mb-1">{winner.player?.avatar}</div>
                <div className="text-sm font-medium text-center max-w-[100px] truncate">{winner.player?.nickname}</div>
                <div className="text-yellow-400 text-base font-bold">{winner.score} pts</div>
                <div className="w-20 h-16 bg-gradient-to-t from-yellow-500/20 to-yellow-500/5 rounded-t-lg flex items-end justify-center pb-2 font-bold text-xl border border-yellow-500/20">1</div>
              </div>
            )}
            {sortedPlayers[2] && (
              <div className="flex flex-col items-center">
                <div className="text-2xl mb-1">🥉</div>
                <div className="text-2xl mb-1">{sortedPlayers[2].player?.avatar}</div>
                <div className="text-xs font-medium text-center max-w-[80px] truncate">{sortedPlayers[2].player?.nickname}</div>
                <div className="text-orange-400 text-sm font-bold">{sortedPlayers[2].score} pts</div>
                <div className="w-16 h-8 bg-white/5 rounded-t-lg flex items-end justify-center pb-2 font-bold text-lg border border-white/5">3</div>
              </div>
            )}
          </div>
        )}

        {/* Rankings */}
        {sortedPlayers && sortedPlayers.length > 0 && (
          <div className="glass rounded-2xl p-4 mb-6 border border-white/10">
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">⭐ Full Rankings</h3>
            <div className="space-y-2">
              {sortedPlayers.map((entry, i) => (
                <div key={entry.id} className={cn("flex items-center gap-3 p-3 rounded-xl transition-all", entry.id === currentPlayer?.id ? "bg-violet-500/10 border border-violet-500/20" : "bg-white/5 border border-white/5")}>
                  <span className="font-bold text-sm w-6 text-white/30">#{i + 1}</span>
                  <span className="text-xl">{entry.player?.avatar}</span>
                  <span className="flex-1 font-medium text-sm">{entry.player?.nickname}{entry.player?.isHost && " 👑"}</span>
                  <span className="font-bold text-sm text-cyan-400">{entry.score} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        <div className="glass rounded-2xl p-4 mb-6 border border-white/10">
          <h3 className="font-semibold text-base mb-3">🎖️ Achievements</h3>
          <div className="grid grid-cols-3 gap-2">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.id} className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xl mb-1">{a.icon}</div>
                <div className="text-xs font-medium text-white/60">{a.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Link href={`/room/${roomCode}/host`} prefetch className="block w-full py-3.5 rounded-xl font-semibold text-sm text-center bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all border border-emerald-500/20">
            <RotateCcw className="w-4 h-4 inline mr-2" /> Play Again
          </Link>
          <Link href="/games" prefetch className="block w-full py-3.5 rounded-xl font-semibold text-sm text-center glass hover:bg-white/10 transition-all border border-white/10">
            <Gamepad2 className="w-4 h-4 inline mr-2" /> Choose Another Game
          </Link>
          <Link href="/" prefetch className="block w-full py-3 rounded-xl font-medium text-sm text-center text-white/40 hover:text-white/60 transition-all">
            <Home className="w-4 h-4 inline mr-2" /> Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
