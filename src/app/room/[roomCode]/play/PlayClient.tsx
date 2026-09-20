"use client";

import Link from "next/link";
import { ArrowLeft, Crown } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { cn } from "@/lib/utils";

interface Props {
  roomCode: string;
}

/** A player's holding screen while the host gathers everyone in the lobby. */
export default function PlayClient({ roomCode }: Props) {
  const { room, player, leaveRoom } = useRoom();
  const game = GAMES.find((g) => g.id === room?.gameId);
  const playerList = Object.values(room?.players ?? {});
  const onlineCount = playerList.filter((p) => p.isConnected).length;

  return (
    <main className="min-h-[100dvh] bg-ink p-4 pb-safe text-white">
      <div className="mx-auto max-w-md pt-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            onClick={() => void leaveRoom()}
            aria-label="離開房間並返回首頁"
            className="glass rounded-xl p-2 transition-all hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="text-center">
            <p className="mb-0.5 text-xs uppercase tracking-wider text-white/40">房間</p>
            <p className="text-xl font-bold tracking-widest">{roomCode}</p>
          </div>
          <p className="text-sm text-emerald-400 tabular-nums">
            <span className="sr-only">在線玩家數</span>
            {onlineCount}
          </p>
        </div>

        {game && (
          <div className="glass-card mb-6 rounded-2xl p-6 text-center">
            <p className="mb-3 text-5xl" aria-hidden="true">
              {game.icon}
            </p>
            <h1 className="mb-1 text-2xl font-bold">{game.name}</h1>
            <p lang="en" className="text-sm text-white/40">
              {game.nameEn}
            </p>
          </div>
        )}

        {player && (
          <div className="glass mb-4 flex items-center gap-3 rounded-2xl border border-white/10 p-4">
            <span className="text-3xl" aria-hidden="true">
              {player.avatar}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 font-semibold">
                {player.nickname}
                {player.isHost && <Crown className="h-4 w-4 text-yellow-400" aria-label="房主" />}
              </span>
              <span className="text-xs text-white/40">{player.isHost ? "房主" : "玩家"}</span>
            </span>
            <span
              className={cn("h-2 w-2 rounded-full", player.isConnected ? "bg-emerald-400" : "bg-red-500")}
              aria-label={player.isConnected ? "在線" : "離線"}
            />
          </div>
        )}

        <section className="py-12 text-center" role="status" aria-live="polite">
          <p className="mb-4 text-5xl" aria-hidden="true">
            ⏳
          </p>
          <h2 className="mb-2 text-2xl font-bold">等待房主開始</h2>
          <p className="text-sm text-white/40">
            目前 {onlineCount} 人在房間裡
            {game ? `，湊滿 ${game.minPlayers} 人就能開始` : ""}
          </p>
        </section>
      </div>
    </main>
  );
}
