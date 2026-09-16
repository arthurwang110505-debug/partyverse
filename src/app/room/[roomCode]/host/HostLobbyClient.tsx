"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2, Settings, Power, Users, Crown, RefreshCw } from "lucide-react";
import { useRoom, usePlayer } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { cn } from "@/lib/utils";

export default function HostLobbyClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const { room, player, startGame, kickPlayer } = useRoom();
  const currentPlayer = usePlayer();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleStart = async () => {
    try { await startGame(); } catch (e) { console.error(e); }
  };

  const handleEnd = async () => {
    if (!confirm("End this room? All players will be disconnected.")) return;
    router.push("/");
  };

  const game = GAMES.find((g) => g.id === room?.gameId);
  const players = room?.players || {};
  const playerList = Object.values(players).sort((a, b) => a.id.localeCompare(b.id));
  const onlineCount = playerList.filter((p) => p.isConnected).length;

  return (
    <div className="min-h-screen bg-[#050508] text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 text-sm text-white/50 mb-4 border border-white/10">
            {game?.icon} {game?.name}
          </div>
          <h1 className="font-bold text-4xl md:text-5xl mb-2">Lobby</h1>
          <p className="text-white/40 text-sm">Waiting for players to join...</p>
        </div>

        {/* Room code */}
        <div className="glass-card rounded-2xl p-6 mb-6 text-center">
          <div className="text-white/40 text-xs uppercase tracking-wider mb-2">Room Code</div>
          <div className="font-bold text-5xl md:text-6xl tracking-[0.2em] mb-4" style={{ color: game?.color || "#a855f7" }}>
            {roomCode}
          </div>
          <div className="inline-block p-4 rounded-2xl bg-white mb-4">
            <QRCodeSVG value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${roomCode}`} size={160} level="H" />
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <button onClick={handleCopyCode} className="px-4 py-2 rounded-xl bg-white/5 text-sm font-medium hover:bg-white/10 flex items-center gap-2 transition-all border border-white/10">
              {copied ? <span className="text-emerald-400">✓ Copied!</span> : <><Copy className="w-4 h-4" /> Copy Code</>}
            </button>
            <button onClick={() => setShowQR(!showQR)} className="px-4 py-2 rounded-xl bg-white/5 text-sm font-medium hover:bg-white/10 flex items-center gap-2 transition-all border border-white/10">
              <Share2 className="w-4 h-4" /> Fullscreen QR
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="glass rounded-2xl p-5 mb-6 border border-white/10">
          <h2 className="font-semibold text-base flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-violet-400" /> Players ({onlineCount}/{playerList.length})
          </h2>
          <div className="space-y-2">
            {playerList.map((p) => (
              <div key={p.id} className={cn("flex items-center justify-between p-3 rounded-xl transition-all", p.isConnected ? "bg-white/5" : "bg-white/5 opacity-40")}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{p.avatar}</span>
                  <span className="font-medium text-sm">{p.nickname}</span>
                  {p.isHost && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                  <span className={cn("w-1.5 h-1.5 rounded-full", p.isConnected ? "bg-emerald-400" : "bg-red-500")} />
                </div>
                {p.isHost && <span className="text-xs text-yellow-400/80 font-medium bg-yellow-400/10 px-2 py-0.5 rounded-full">HOST</span>}
              </div>
            ))}
            {playerList.length === 0 && <div className="text-center py-8 text-white/30 text-sm">No players yet. Share the code!</div>}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button onClick={handleStart} disabled={onlineCount < 2}
            className="col-span-2 md:col-span-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{ background: onlineCount >= 2 ? "linear-gradient(135deg, #22c55e, #16a34a)" : "rgba(255,255,255,0.05)", opacity: onlineCount >= 2 ? 1 : 0.4, cursor: onlineCount >= 2 ? "pointer" : "not-allowed" }}>
            <Crown className="w-4 h-4" /> Start
          </button>
          <button className="py-3 rounded-xl font-semibold text-sm bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 transition-all border border-white/10">
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button className="py-3 rounded-xl font-semibold text-sm bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 transition-all border border-white/10">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={handleEnd} className="py-3 rounded-xl font-semibold text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-2 transition-all border border-red-500/20">
            <Power className="w-4 h-4" /> End
          </button>
        </div>
      </div>

      {/* Fullscreen QR */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-[#050508]/95 flex items-center justify-center p-8" onClick={() => setShowQR(false)}>
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <div className="inline-block p-8 rounded-3xl bg-white mb-6">
              <QRCodeSVG value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${roomCode}`} size={300} level="H" />
            </div>
            <p className="font-bold text-3xl tracking-[0.2em] mb-2" style={{ color: game?.color || "#a855f7" }}>{roomCode}</p>
            <p className="text-white/40 text-sm">Scan to join the party</p>
            <button onClick={() => setShowQR(false)} className="mt-8 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium transition-all border border-white/10">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
