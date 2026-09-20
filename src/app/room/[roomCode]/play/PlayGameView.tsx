"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { BombGameState } from "@/engine/bombCountdown";
import { HOST_STALE_MS } from "@/constants/room";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { PlayShell } from "@/components/game/PlayShell";
import { cn } from "@/lib/utils";
import { sfx, vibrate } from "@/lib/sound";

import PlayEverybodyKnows from "./views/PlayEverybodyKnows";
import PlayAiBullshit from "./views/PlayAiBullshit";
import PlayUndercover from "./views/PlayUndercover";
import PlaySong3Seconds from "./views/PlaySong3Seconds";
import PlayKingTonight from "./views/PlayKingTonight";
import PlayFireworkMaster from "./views/PlayFireworkMaster";
import PlayDrawAndGuess from "./views/PlayDrawAndGuess";
import PlayRealBattle from "./views/PlayRealBattle";
import PlayMysteryRoom from "./views/PlayMysteryRoom";

/**
 * Mobile Controller View Dispatcher.
 * Every game-specific view (and the bomb fallback below) renders inside the
 * shared `PlayShell`, so identity / score / room / sound chrome is identical
 * across all ten games.
 */
export default function PlayGameView() {
  const { room, player, isHost, submitAction, claimHost } = useRoom();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const gameId = room?.gameId;
  const isBombGame = !gameId || gameId === "bombcountdown";

  // Default: Bomb Countdown Controller
  const state = room?.gameState as BombGameState | undefined;

  const isMyTurn = Boolean(player && state?.bombHolderId === player.id);
  const isEliminated = Boolean(player && state?.eliminatedPlayers.includes(player.id));
  const hostStale = Boolean(
    room?.status === "PLAYING" && room.lastTickAt && Date.now() - room.lastTickAt > HOST_STALE_MS && !isHost,
  );

  // Vibration on my turn or critical bomb
  useEffect(() => {
    if (isBombGame && isMyTurn) {
      vibrate([100, 50, 100]);
    }
  }, [isBombGame, isMyTurn]);

  useEffect(() => {
    if (pending) setPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.bombHolderId, state?.bombTimeLeft]);

  // Specific game views (each renders its own PlayShell)
  if (gameId === "everybodyknows") return <PlayEverybodyKnows />;
  if (gameId === "aibullshit") return <PlayAiBullshit />;
  if (gameId === "whoisundercoveragent") return <PlayUndercover />;
  if (gameId === "song3seconds") return <PlaySong3Seconds />;
  if (gameId === "kingtonight") return <PlayKingTonight />;
  if (gameId === "fireworkmaster") return <PlayFireworkMaster />;
  if (gameId === "drawandguess") return <PlayDrawAndGuess />;
  if (gameId === "realbattle") return <PlayRealBattle />;
  if (gameId === "mysteryroom") return <PlayMysteryRoom />;

  const answer = async (value: string) => {
    setPending(true);
    setError("");
    try {
      await submitAction({ type: "answer", answer: value });
      sfx.playSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "送出失敗，請再試一次");
      toast("送出失敗，請再試一次");
      setPending(false);
    }
  };

  if (!room || !player) return null;

  const timeLeft = state?.bombTimeLeft ?? 0;
  const critical = timeLeft <= 3;

  return (
    <PlayShell round={`第 ${state?.currentRound ?? 1} / ${state?.totalRounds ?? 1} 回合`}>
      <div className="pt-6">
        {hostStale && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
            <p className="mb-2 text-sm text-amber-300">房主似乎已經離線，遊戲暫停中</p>
            <Button size="sm" variant="ghost" onClick={() => claimHost().catch(() => setError("接管失敗"))}>
              由我接管房主
            </Button>
          </div>
        )}

        {state && state.phase === "challenge" && (
          <div className="mb-6 flex justify-center">
            <p
              className={cn(
                "flex h-32 w-32 items-center justify-center rounded-full text-5xl font-bold tabular-nums transition-all duration-300",
                critical ? "bg-red-500" : timeLeft <= 5 ? "bg-orange-500" : "bg-white/10",
              )}
              style={{ boxShadow: critical ? "0 0 60px rgba(239,68,68,0.6)" : "none" }}
              aria-hidden="true"
            >
              {timeLeft}
            </p>
          </div>
        )}

        {state?.lastEliminatedId === player.id && (
          <p className="mb-4 text-center text-sm text-red-400" role="status">
            炸彈在你手上爆炸了！
          </p>
        )}

        {isEliminated ? (
          <section className="py-12 text-center">
            <p className="mb-4 text-6xl" aria-hidden="true">
              💀
            </p>
            <h2 className="mb-2 text-2xl font-bold text-red-400">你出局了</h2>
            <p className="text-sm text-white/40">看看誰能撐到最後</p>
          </section>
        ) : state?.phase === "result" ? (
          <section className="py-12 text-center">
            <p className="mb-4 text-6xl" aria-hidden="true">
              🏆
            </p>
            <h2 className="text-2xl font-bold">遊戲結束</h2>
            <p className="mt-2 text-sm text-white/40">正在結算…</p>
          </section>
        ) : isMyTurn && state?.challenge ? (
          <section aria-labelledby="turn-heading">
            <h2 id="turn-heading" className="mb-4 text-center">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-400">
                換你了！快拆彈！
              </span>
              <span className="block text-lg font-bold">{state.challenge.question}</span>
            </h2>
            <div className="space-y-2">
              {state.challenge.options.map((option) => (
                <Button
                  key={option}
                  variant="ghost"
                  size="md"
                  className="w-full"
                  disabled={pending}
                  onClick={() => void answer(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
            <ErrorNote className="mt-4">{error}</ErrorNote>
          </section>
        ) : state?.phase === "challenge" ? (
          <section className="py-12 text-center" role="status">
            <p className="mb-3 text-4xl" aria-hidden="true">
              ⏳
            </p>
            <p className="text-sm text-white/40">
              等 <span className="font-semibold text-white/70">{room.players[state.bombHolderId]?.nickname ?? "其他玩家"}</span>{" "}
              拆彈…
            </p>
          </section>
        ) : (
          <section className="py-12 text-center" role="status">
            <p className="mb-3 text-4xl" aria-hidden="true">
              💣
            </p>
            <p className="text-sm text-white/40">準備中…</p>
          </section>
        )}
      </div>
    </PlayShell>
  );
}
