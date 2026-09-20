"use client";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import { GAMES } from "@/constants/games";
import type { BombGameState } from "@/engine/bombCountdown";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sound";

import HostEverybodyKnows from "./views/HostEverybodyKnows";
import HostAiBullshit from "./views/HostAiBullshit";
import HostUndercover from "./views/HostUndercover";
import HostSong3Seconds from "./views/HostSong3Seconds";
import HostKingTonight from "./views/HostKingTonight";
import HostFireworkMaster from "./views/HostFireworkMaster";
import HostDrawAndGuess from "./views/HostDrawAndGuess";
import HostRealBattle from "./views/HostRealBattle";
import HostMysteryRoom from "./views/HostMysteryRoom";

/**
 * The TV Big-Screen View Dispatcher.
 * Every game view renders inside the shared `HostShell` (identity bar, sound
 * toggle, tick/reveal audio bed). Only the bomb board below is bespoke.
 */
export default function HostGameView() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const [flash, setFlash] = useState<string | null>(null);
  const lastEliminated = useRef<string | null>(null);

  const gameId = room?.gameId;
  const isBombGame = !gameId || gameId === "bombcountdown";

  const state = room?.gameState as BombGameState | undefined;
  const game = GAMES.find((g) => g.id === room?.gameId);
  const players = room?.players ?? {};

  const eliminated = new Set(state?.eliminatedPlayers ?? []);
  const activePlayers = Object.entries(players).filter(([id]) => !eliminated.has(id));
  const eliminatedPlayers = Object.entries(players).filter(([id]) => eliminated.has(id));
  const holder = state?.bombHolderId ? players[state.bombHolderId] : undefined;

  // Bomb-specific sting: boom + name flash on elimination. (Generic tick and
  // phase stings live in HostShell — including for this view.)
  useEffect(() => {
    if (!isBombGame) return;
    const id = state?.lastEliminatedId ?? null;
    if (id && id !== lastEliminated.current) {
      sfx.playBoom();
      setFlash(room?.players?.[id]?.nickname ?? null);
      const t = setTimeout(() => setFlash(null), 1400);
      lastEliminated.current = id;
      return () => clearTimeout(t);
    }
    lastEliminated.current = id;
  }, [isBombGame, state?.lastEliminatedId, room?.players]);

  // Delegate non-bomb games to their dedicated views (each with its own HostShell)
  if (gameId === "everybodyknows") return <HostEverybodyKnows />;
  if (gameId === "aibullshit") return <HostAiBullshit />;
  if (gameId === "whoisundercoveragent") return <HostUndercover />;
  if (gameId === "song3seconds") return <HostSong3Seconds />;
  if (gameId === "kingtonight") return <HostKingTonight />;
  if (gameId === "fireworkmaster") return <HostFireworkMaster />;
  if (gameId === "drawandguess") return <HostDrawAndGuess />;
  if (gameId === "realbattle") return <HostRealBattle />;
  if (gameId === "mysteryroom") return <HostMysteryRoom />;

  const timeLeft = state?.bombTimeLeft ?? 0;
  const critical = timeLeft <= 3;

  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : "操作失敗";
    toast(msg);
  };

  return (
    <HostShell>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
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
          style={{ color: critical ? "#ef4444" : game?.color ?? "#ffe600" }}
          aria-hidden="true"
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
            <PlayerChip
              key={id}
              avatar={p.avatar}
              nickname={p.nickname}
              score={state?.currentScores?.[id] ?? 0}
              highlight={id === state?.bombHolderId}
            />
          ))}
          {eliminatedPlayers.map(([id, p]) => (
            <PlayerChip key={id} avatar={p.avatar} nickname={p.nickname} status="出局" out />
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="ghost" size="md" onClick={() => endRound().catch(fail)}>
            重新開始這一局
          </Button>
          <Button variant="danger" size="md" onClick={() => endGame().catch(fail)}>
            結束遊戲並結算
          </Button>
        </div>
      </div>
    </HostShell>
  );
}
