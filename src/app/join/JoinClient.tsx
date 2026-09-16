"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { useRoom } from "@/providers/RoomContext";

export default function JoinClient() {
  const router = useRouter();
  const { joinRoom, loading } = useRoom();
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!roomCode.trim()) { setError("Please enter a room code"); return; }
    if (!nickname.trim()) { setError("Please enter a nickname"); return; }
    setError("");
    try {
      await joinRoom(roomCode.trim().toUpperCase(), nickname.trim());
      router.push(`/join/${roomCode.trim().toUpperCase()}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to join room");
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 mb-8 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🎮</div>
          <h1 className="font-bold text-2xl mb-2">Join Party</h1>
          <p className="text-white/40 text-sm">Enter a room code to join the fun</p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Room Code</label>
            <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="ABC12" maxLength={5}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl font-bold tracking-widest placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
              onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Your Name</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Enter your name..." maxLength={16}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
              onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
          </div>

          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{error}</div>}

          <button onClick={handleJoin} disabled={loading || !roomCode.trim() || !nickname.trim()}
            className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Users className="w-4 h-4" /> {loading ? "Joining..." : "Join Party"}
          </button>
        </div>
      </div>
    </div>
  );
}
