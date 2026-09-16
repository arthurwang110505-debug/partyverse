"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Crown } from "lucide-react";
import Link from "next/link";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";

interface Props {
  gameId: string;
}

export default function CreateRoomClient({ gameId }: Props) {
  const router = useRouter();
  const { createRoom } = useRoom();
  const game = GAMES.find((g) => g.id === gameId);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!game) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="text-white/50 text-lg">Game not found</div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!nickname.trim()) { setError("Please enter a nickname"); return; }
    setLoading(true);
    setError("");
    try {
      const roomCode = await createRoom(game.id, nickname.trim(), {
        timer: 15,
        difficulty: "easy",
        rounds: 3,
        soundEnabled: true,
        ageMode: "family",
      });
      router.push(`/room/${roomCode}/host`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-4 py-24">
      <div className="max-w-md w-full">
        <Link href={`/games/${game.id}`} prefetch className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 mb-8 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{game.icon}</span>
            <h1 className="font-bold text-2xl">{game.name}</h1>
          </div>
          <p className="text-white/40 text-sm mb-8">{game.nameEn}</p>
        </motion.div>

        <div className="glass-card rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Your Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your name..."
              maxLength={16}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || !nickname.trim()}
            className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{ background: game.gradient, opacity: loading || !nickname.trim() ? 0.5 : 1 }}
          >
            {loading ? (
              <span className="animate-pulse">Creating room...</span>
            ) : (
              <><Crown className="w-4 h-4" /> Create Room</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
