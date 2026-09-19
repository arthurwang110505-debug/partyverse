"use client";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import type { BombGameState } from "@/engine/bombCountdown";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { cn } from "@/lib/utils";

/**
 * The big-screen view.
 *
 * It reads state straight from the room context. It used to open its own second
 * `onValue` listener on the same path *and* run a local `setInterval` that only
 * ever called `setDisplayState` — so the countdown advanced on the host's screen
 * and nowhere else. The tick now lives in `RoomProvider` and publishes to the
 * database, which every client already listens to.
 */
export default function HostGameView() {
  const { room, endRound, endGame } = useRoom();
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const lastEliminated = useRef<string | null>(null);

  const state = room?.gameState as BombGameState | undefined;
  const game = GAMES.find((g) => g.id === room?.gameId);
  const players = room?.players ?? {};

  const eliminated = new Set(state?.eliminatedPlayers ?? []);
  const activePlayers = Object.entries(players).filter(([id]) => !eliminated.has(id));
  const eliminatedPlayers = Object.entries(players).filter(([id]) => eliminated.has(id));
  const holder = state?.bombHolderId ? players[state.bombHolderId] : undefined;

  // Brief "boom" flash when someone new is knocked out.
  useEffect(() => {
    const id = state?.lastEliminatedId ?? null;
    if (id && id !== lastEliminated.current) {
      setFlash(room?.players?.[id]?.nickname ?? null);
      const t = setTimeout(() => setFlash(null), 1400);
      lastEliminated.current = id;
      return () => clearTimeout(t);
    }
    lastEliminated.current = id;
  }, [state?.lastEliminatedId, room?.players]);

  const timeLeft = state?.bombTimeLeft ?? 0;
  const critical = timeLeft <= 3;

  return (
    <main className="min-h-screen bg-ink p-4 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="mb-2 text-sm text-white/40">
            <span aria-hidden="true">{game?.icon}</span> {game?.name}
          </p>
          <h1 className="text-xl font-bold">
            第 {state?.currentRound ?? 1} / {state?.totalRounds ?? 1} 回合
          </h1>
        </header>

        {flash && (
          <p className="mb-6 text-center text-2xl font-bold text-red-400" role="status">
            💥 {flash} 被淘汰了！
          </p>
        )}

        <div className="mb-8 flex justify-center">
          <div
            className={cn(
              "flex h-40 w-40 items-center justify-center rounded-full text-7xl transition-all duration-300",
              critical ? "animate-pulse bg-red-500" : timeLeft <= 5 ? "bg-orange-500" : "bg-white/10",
            )}
            style={{ boxShadow: critical ? "0 0 60px rgba(239,68,68,0.6)" : "none" }}
            aria-hidden="true"
          >
            {state?.phase === "result" ? "🏆" : "💣"}
          </div>
        </div>

        <p
          className="mb-6 text-center text-7xl font-bold tabular-nums"
          style={{ color: critical ? "#ef4444" : "#ffe600" }}
          aria-live="off"
        >
          {timeLeft}
        </p>

        {holder && state?.phase === "challenge" && (
          <div className="mb-6 text-center">
            <div className="glass inline-flex items-center gap-3 rounded-2xl px-6 py-4">
              <span className="text-4xl" aria-hidden="true">
                {holder.avatar}
              </span>
              <span className="text-left">
                <span className="mb-0.5 block text-xs uppercase tracking-wider text-white/40">炸彈在誰手上</span>
                <span className="block text-xl font-bold">{holder.nickname}</span>
              </span>
            </div>
          </div>
        )}

        {state?.challenge && state.phase === "challenge" && (
          <p className="mb-8 text-center text-2xl font-semibold text-white/80">{state.challenge.question}</p>
        )}

        <ul className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {activePlayers.map(([id, p]) => (
            <li
              key={id}
              className={cn(
                "rounded-xl border p-3 text-center transition-all",
                id === state?.bombHolderId
                  ? "border-violet-500/40 bg-violet-500/20"
                  : "border-white/5 bg-white/5",
              )}
            >
              <p className="mb-1 text-2xl" aria-hidden="true">
                {p.avatar}
              </p>
              <p className="truncate text-sm font-medium">{p.nickname}</p>
              <p className="text-xs text-white/40 tabular-nums">{state?.currentScores?.[id] ?? 0} 分</p>
            </li>
          ))}
          {eliminatedPlayers.map(([id, p]) => (
            <li key={id} className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center opacity-50">
              <p className="mb-1 text-2xl" aria-hidden="true">
                💀
              </p>
              <p className="truncate text-sm font-medium">{p.nickname}</p>
              <p className="text-xs text-red-400">出局</p>
            </li>
          ))}
        </ul>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => endRound().catch((e) => setError(e instanceof Error ? e.message : "操作失敗"))}
          >
            重新開始這一局
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => endGame().catch((e) => setError(e instanceof Error ? e.message : "操作失敗"))}
          >
            結束遊戲並結算
          </Button>
        </div>
      </div>
    </main>
  );
}
